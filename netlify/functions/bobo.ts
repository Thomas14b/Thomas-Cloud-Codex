import OpenAI from "openai";
import type { Config } from "@netlify/functions";
import { authenticated, transaction } from "../../server/database";
import {
  requireOrigin,
  readBody,
  respond,
  failure,
  HttpError,
  uuid,
} from "../../server/security";
import { instructions, validateBody } from "../../server/bobo";
export default async (req: Request) => {
  let requestId: string | undefined;
  let user: Awaited<ReturnType<typeof authenticated>> | undefined;
  let reserved = false;
  try {
    if (req.method !== "POST") throw new HttpError(405, "只接受 POST");
    requireOrigin(req);
    user = await authenticated();
    const body = await readBody(req);
    requestId = uuid(body.requestId);
    let message: string;
    try {
      message = validateBody(body);
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
    if (!process.env.OPENAI_BASE_URL || !process.env.OPENAI_API_KEY)
      throw new HttpError(503, "Netlify AI Gateway 尚未啟用");
    const prep = await transaction(user, async (client) => {
      const prior = (
        await client.query("select game.reserve_ai_request($1) as result", [
          requestId,
        ])
      ).rows[0].result;
      if (prior.reply) return { reply: prior.reply, history: [] };
      const history = (
        await client.query(
          "select role,content from game.chat_messages where player_id=$1 order by id desc limit 6",
          [user!.id],
        )
      ).rows.reverse();
      return { reply: null, history };
    });
    if (prep.reply) return respond({ reply: prep.reply });
    reserved = true;
    const client = new OpenAI();
    // The gateway supplies both API key and base URL. Never fall back to an unconfigured direct provider.
    const response = await client.responses.create(
      {
        model: process.env.BOBO_MODEL || "gpt-4.1-mini",
        instructions,
        input: [
          ...prep.history.map((x) => ({
            role: x.role as "user" | "assistant",
            content: String(x.content).slice(0, 1500),
          })),
          { role: "user", content: message },
        ],
        max_output_tokens: 500,
        store: false,
      },
      { timeout: 40000, maxRetries: 0 },
    );
    const answer = response.output_text?.trim();
    if (!answer) throw new HttpError(502, "AI 沒有傳回有效回覆，請重試");
    await transaction(user, async (db) => {
      // clear_chat marks pending requests failed; an in-flight reply cannot resurrect deleted history.
      const result = await db.query(
        "update game.ai_requests set state='completed',reply=$1,input_tokens=$2,output_tokens=$3 where id=$4 and player_id=$5 and state='pending' returning id",
        [
          answer,
          response.usage?.input_tokens ?? null,
          response.usage?.output_tokens ?? null,
          requestId,
          user!.id,
        ],
      );
      if (result.rowCount !== 1)
        throw new HttpError(409, "對話已清除，這次回覆不會儲存");
      await db.query(
        "insert into game.chat_messages(player_id,role,content) values($1,'user',$2),($1,'assistant',$3)",
        [user!.id, message, answer],
      );
    });
    return respond({ reply: answer });
  } catch (e) {
    if (reserved && user && requestId)
      try {
        await transaction(user, async (db) => {
          await db.query(
            "update game.ai_requests set state='failed' where id=$1 and player_id=$2 and state='pending'",
            [requestId, user!.id],
          );
        });
      } catch {
        /* Preserve original error without exposing database diagnostics. */
      }
    if (e instanceof OpenAI.APIError)
      return respond(
        {
          error:
            e.status === 429
              ? "AI 暫時繁忙或服務額度不足，請稍後重試"
              : "AI 服務暫時無法回覆，請重試",
        },
        502,
      );
    return failure(e);
  }
};
export const config: Config = { path: "/api/bobo" };
