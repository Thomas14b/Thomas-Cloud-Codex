import { useEffect, useRef, useState } from "react";
import { db, rpc } from "./api";
import { message } from "./data";
import type { Chat } from "./data";
import { Monster } from "./Monster";
import { Send, Trash2 } from "lucide-react";
export function ChatPanel({ userId }: { userId: string }) {
  const [messages, setMessages] = useState<Chat[]>([]),
    [input, setInput] = useState(""),
    [busy, setBusy] = useState(false),
    [consent, setConsent] = useState(false),
    [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    db!
      .from("chat_messages")
      .select("id,role,content")
      .eq("player_id", userId)
      .order("id", { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setError(error.message);
        else setMessages((data as Chat[]).reverse());
      });
    return () => {
      active = false;
    };
  }, [userId]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "auto", block: "nearest" });
  }, [messages, busy]);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !consent || !input.trim()) return;
    setBusy(true);
    setError("");
    try {
      const { data, error } = await db!.functions.invoke("bobo", {
        body: { message: input, consent: true },
      });
      if (error) {
        let detail = "波波暫時未能連線，請稍後重試。";
        try {
          const body = await error.context.json();
          detail = body.error || detail;
        } catch {}
        throw new Error(detail);
      }
      if (!data?.reply) throw new Error("未收到有效 AI 回覆");
      setMessages((old) => [
        ...old,
        { id: Date.now(), role: "user", content: input },
        { id: Date.now() + 1, role: "assistant", content: data.reply },
      ]);
      setInput("");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR AI COMPANION</span>
          <h1>同波波，慢慢傾。</h1>
          <p className="muted">不急著找答案，先聽聽你的故事。</p>
        </div>
        <button
          className="secondary"
          disabled={busy}
          onClick={async () => {
            if (!confirm("刪除帳戶內所有波波對話？")) return;
            try {
              await rpc("clear_chat");
              setMessages([]);
            } catch (e) {
              setError(message(e));
            }
          }}
        >
          <Trash2 size={16} />
          清除紀錄
        </button>
      </div>
      <section className="panel chat">
        <div className="chat-header">
          <Monster index={1} size={65} />
          <div>
            <h3>波波 · 魔法管家</h3>
            <span className="small muted">
              AI 回覆可能有誤；不會代你完成任務或發獎勵。
            </span>
          </div>
        </div>
        <div className="chat-log" aria-live="polite">
          {!messages.length && (
            <div className="empty">
              <Monster index={1} size={120} />
              <h2>今日，有甚麼想分享？</h2>
              <p>
                你可以講一次小失敗、一個新發現，
                <br />
                或者一件仲未敢做的事。
              </p>
            </div>
          )}
          {messages.map((m, i) => (
            <div className={`bubble ${m.role}`} key={`${m.id}-${i}`}>
              <span className="small">
                {m.role === "user" ? "你" : "波波 · AI"}
              </span>
              <p>{m.content}</p>
            </div>
          ))}
          {busy && <p role="status">波波正在想一想…</p>}
          <div ref={end} />
        </div>
        {error && (
          <p className="alert error" role="alert">
            {error} 你輸入的文字已保留，可再次送出。
          </p>
        )}
        <form onSubmit={send}>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              我同意將本次文字及最近對話送至 AI
              服務處理。紀錄儲存於我的帳戶，不開放給學院管理員；請不要輸入敏感個人資料。
            </span>
          </label>
          <label>
            想同波波講的話
            <textarea
              required
              maxLength={2000}
              value={input}
              disabled={busy}
              onChange={(e) => setInput(e.target.value)}
              placeholder="今日我試咗…"
            />
          </label>
          <div className="row between">
            <span className="small muted">
              每日最多 20 次 · 最近 100 則紀錄
            </span>
            <button
              className="primary"
              disabled={busy || !consent || !input.trim()}
            >
              <Send size={18} />
              {busy ? "回覆中…" : "送出"}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
