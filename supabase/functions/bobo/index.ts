import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { askAI, validateBody, type Message } from "./handler.ts";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply({ error: "只接受 POST" }, 405);
  const token = req.headers.get("Authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return reply({ error: "請先登入" }, 401);
  const url = Deno.env.get("SUPABASE_URL"),
    service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) return reply({ error: "服務尚未設定" }, 503);
  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(token);
  if (authError || !user)
    return reply({ error: "登入已失效，請重新登入" }, 401);
  const key = Deno.env.get("OPENAI_API_KEY"),
    model = Deno.env.get("OPENAI_MODEL");
  if (!key || !model)
    return reply({ error: "波波的 AI 服務尚未設定，請聯絡管理員" }, 503);
  let message: string;
  try {
    const text = await req.text();
    if (text.length > 12000) return reply({ error: "內容過長" }, 413);
    message = validateBody(JSON.parse(text));
  } catch (e) {
    return reply({ error: e instanceof Error ? e.message : "內容無效" }, 400);
  }
  try {
    const { error: quota } = await admin.rpc("claim_ai_quota", {
      p_player: user.id,
    });
    if (quota)
      return reply(
        {
          error: quota.message.includes("每日")
            ? quota.message
            : "暫時無法確認對話額度",
        },
        429,
      );
    const { data: history, error: historyError } = await admin
      .from("chat_messages")
      .select("role,content")
      .eq("player_id", user.id)
      .order("id", { ascending: false })
      .limit(12);
    if (historyError) throw new Error("暫時無法讀取對話紀錄");
    const answer = await askAI(
      key,
      model,
      (history as Message[]).reverse(),
      message,
    );
    const { error: saveError } = await admin.from("chat_messages").insert([
      { player_id: user.id, role: "user", content: message },
      { player_id: user.id, role: "assistant", content: answer },
    ]);
    if (saveError) throw new Error("無法儲存對話，請稍後再試");
    return reply({ reply: answer });
  } catch (e) {
    return reply(
      {
        error:
          e instanceof Error && e.name === "TimeoutError"
            ? "AI 回覆逾時，請重試"
            : e instanceof Error
              ? e.message
              : "AI 服務暫時無法使用",
      },
      502,
    );
  }
});
