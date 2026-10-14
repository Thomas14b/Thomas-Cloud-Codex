import { useCallback, useEffect, useState } from "react";
import {
  Users,
  CheckCircle,
  Clock,
  MessageSquare,
  Download,
  Search,
  RefreshCw,
} from "lucide-react";
import { rpc, rows } from "./api";
import { date, families, level, message, stage, stateLabel } from "./data";
import type {
  Profile,
  Attempt,
  Card,
  Redemption,
  Mission,
  Reward,
} from "./data";
import { QR } from "./QR";
interface Player extends Profile {
  completed: number;
  pending: number;
  feedback_count: number;
  last_attempt: string | null;
}
interface Input {
  id: string;
  player_id: string;
  display_name: string;
  body: string;
  created_at: string;
  mission_id: string | null;
}
interface Overview {
  players: number;
  completed: number;
  pending: number;
  feedback: number;
  reflections: number;
  redemptions: number;
  families: { family: string; completed: number }[];
  activity: { day: string; completed: number }[];
}
interface Detail {
  profile: Profile;
  attempts: Attempt[];
  reflections: { attempt_id: string; body: string; created_at: string }[];
  feedback: { body: string; created_at: string }[];
  cards: Card[];
  redemptions: Redemption[];
}
function exportCSV(records: Record<string, unknown>[], name: string) {
  if (!records.length) return;
  const fields = Object.keys(records[0]);
  const escape = (v: unknown) =>
    '"' +
    String(v ?? "")
      .replace(/^[\s]*[=+@\-\t\r]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  const csv =
    "\ufeff" +
    [
      fields.map(escape).join(","),
      ...records.map((row) => fields.map((f) => escape(row[f])).join(",")),
    ].join("\r\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
export function Admin() {
  const [overview, setOverview] = useState<Overview | null>(null),
    [tab, setTab] = useState("players"),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [page, setPage] = useState(0),
    [total, setTotal] = useState(0),
    [players, setPlayers] = useState<Player[]>([]),
    [inputs, setInputs] = useState<Input[]>([]),
    [detail, setDetail] = useState<Detail | null>(null),
    [missions, setMissions] = useState<Mission[]>([]),
    [rewards, setRewards] = useState<Reward[]>([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((x) => x + 1), []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      rpc<Overview>("admin_overview"),
      rows<Mission>("missions"),
      rows<Reward>("rewards"),
      tab === "players"
        ? rpc<{ total: number; players: Player[] }>("admin_players", {
            p_search: query,
            p_stage: filter,
            p_page: page,
          })
        : ["feedback", "reflections"].includes(tab)
          ? rpc<{ total: number; inputs: Input[] }>("admin_inputs", {
              p_kind: tab,
              p_search: query,
              p_page: page,
            })
          : Promise.resolve(null),
    ])
      .then(([o, m, r, list]) => {
        if (!active) return;
        setOverview(o);
        setMissions(m);
        setRewards(r);
        if (list) {
          setTotal(list.total);
          if ("players" in list) setPlayers(list.players);
          else setInputs(list.inputs);
        }
      })
      .catch((e) => {
        if (active) setError(message(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tab, query, filter, page, revision]);
  async function act(fn: () => Promise<unknown>, text = "已儲存") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      setNotice(text);
      refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function inspect(id: string) {
    setBusy(true);
    setError("");
    try {
      setDetail(await rpc<Detail>("admin_player_detail", { p_player: id }));
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  function switchTab(t: string) {
    setTab(t);
    setPage(0);
    setSearch("");
    setQuery("");
    setDetail(null);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ACADEMY / ADMINISTRATION</span>
          <h1>看見每一位同學的成長。</h1>
          <p className="muted">玩家資料、遊戲階段與真實回饋，集中在這裡。</p>
        </div>
        <button className="secondary" onClick={refresh} disabled={loading}>
          <RefreshCw size={17} />
          更新資料
        </button>
      </div>
      <p className="privacy">
        管理員可閱讀遊戲反思與回饋；AI
        私人對話不提供查閱或匯出。匯出資料請妥善保管。
      </p>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="alert success" role="status">
          {notice}
        </p>
      )}
      {loading && <p role="status">載入管理資料中…</p>}
      {overview && (
        <>
          <div className="stats admin-stats">
            {[
              [Users, "玩家人數", overview.players],
              [CheckCircle, "完成任務", overview.completed],
              [Clock, "等待見證", overview.pending],
              [MessageSquare, "玩家回饋", overview.feedback],
            ].map(([Icon, label, value]) => {
              const I = Icon as typeof Users;
              return (
                <div key={String(label)}>
                  <I size={19} />
                  <span>{String(label)}</span>
                  <strong>{String(value)}</strong>
                </div>
              );
            })}
          </div>
          <div className="chart-grid">
            <section className="panel">
              <h3>最近 14 天 · 任務完成</h3>
              <div
                className="bar-chart"
                role="img"
                aria-label={overview.activity
                  .map((d) => `${d.day}: ${d.completed} 次`)
                  .join("，")}
              >
                {overview.activity.map((d) => (
                  <div key={d.day} title={`${d.day}：${d.completed} 次`}>
                    <span>{d.completed}</span>
                    <i
                      style={{
                        height: `${Math.max(3, (90 * Number(d.completed)) / Math.max(1, ...overview.activity.map((x) => Number(x.completed))))}px`,
                      }}
                    />
                    <small>{d.day.slice(5)}</small>
                  </div>
                ))}
              </div>
            </section>
            <section className="panel">
              <h3>精靈家族 · 完成分布</h3>
              {families.map((f) => {
                const count = Number(
                  overview.families.find((x) => x.family === f)?.completed ?? 0,
                );
                return (
                  <div className="family-bar" key={f}>
                    <span>{f}</span>
                    <progress
                      max={Math.max(
                        1,
                        ...overview.families.map((x) => Number(x.completed)),
                      )}
                      value={count}
                      aria-label={`${f} 完成數`}
                    />
                    <b>{count}</b>
                  </div>
                );
              })}
            </section>
          </div>
        </>
      )}
      <div className="tabs" role="tablist" aria-label="管理資料分類">
        {[
          ["players", "玩家資料"],
          ["reflections", "遊戲反思"],
          ["feedback", "玩家回饋"],
          ["manage", "任務與獎勵"],
        ].map(([id, label]) => (
          <button
            role="tab"
            aria-selected={tab === id}
            key={id}
            onClick={() => switchTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab !== "manage" && !detail && (
        <>
          <form
            className="admin-toolbar"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(0);
              setQuery(search);
            }}
          >
            <label>
              搜尋
              <input
                value={search}
                maxLength={100}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  tab === "players"
                    ? "名稱、電郵或玩家 ID"
                    : "玩家名稱或文字內容"
                }
              />
            </label>
            {tab === "players" && (
              <label>
                遊戲階段
                <select
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="all">所有玩家</option>
                  <option value="new">未完成首次任務</option>
                  <option value="pending">等待見證</option>
                  <option value="completed">已有完成任務</option>
                </select>
              </label>
            )}
            <button className="primary" disabled={loading}>
              <Search size={17} />
              搜尋
            </button>
            <button
              type="button"
              className="secondary"
              disabled={loading}
              onClick={() =>
                exportCSV(
                  tab === "players"
                    ? players.map((p) => ({
                        玩家ID: p.id,
                        名稱: p.display_name,
                        電郵: p.email,
                        完成: p.completed,
                        等待見證: p.pending,
                        點數: p.credits,
                        回饋: p.feedback_count,
                        加入: p.created_at,
                      }))
                    : inputs.map((i) => ({
                        玩家ID: i.player_id,
                        名稱: i.display_name,
                        任務: i.mission_id,
                        內容: i.body,
                        提交: i.created_at,
                      })),
                  `failure-monsters-${tab}-page-${page + 1}.csv`,
                )
              }
            >
              <Download size={16} />
              匯出本頁
            </button>
          </form>
          <p className="small muted">共 {total} 筆 · 每頁 25 筆</p>
          {tab === "players" ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>同學</th>
                    <th>遊戲進度</th>
                    <th>點數</th>
                    <th>回饋</th>
                    <th>加入時間</th>
                    <th>詳情</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <b>{p.display_name}</b>
                        {p.is_admin && <span className="pill">管理員</span>}
                        <small>{p.email}</small>
                      </td>
                      <td>
                        {p.completed} 完成 · {p.pending} 待見證
                      </td>
                      <td>{p.credits}</td>
                      <td>{p.feedback_count}</td>
                      <td>{date(p.created_at)}</td>
                      <td>
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={() => void inspect(p.id)}
                        >
                          查看
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!players.length && !loading && (
                <p className="empty">沒有符合條件的玩家。</p>
              )}
            </div>
          ) : (
            <div>
              {inputs.map((i) => (
                <article className="panel" key={i.id}>
                  <div className="row between">
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => void inspect(i.player_id)}
                    >
                      {i.display_name} ↗
                    </button>
                    <span className="small muted">
                      {i.mission_id && `${i.mission_id} · `}
                      {date(i.created_at)}
                    </span>
                  </div>
                  <p className="preserve">{i.body}</p>
                </article>
              ))}
              {!inputs.length && !loading && (
                <p className="empty">尚未有符合條件的內容。</p>
              )}
            </div>
          )}
          <div className="pagination">
            <button
              className="secondary"
              disabled={page === 0 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              上一頁
            </button>
            <span>第 {page + 1} 頁</span>
            <button
              className="secondary"
              disabled={(page + 1) * 25 >= total || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              下一頁
            </button>
          </div>
        </>
      )}
      {detail && (
        <>
          <button className="text-button" onClick={() => setDetail(null)}>
            ← 返回列表
          </button>
          <section className="panel">
            <div className="row between">
              <div>
                <h2>{detail.profile.display_name}</h2>
                <p>{detail.profile.email}</p>
                <p className="small break">玩家 ID：{detail.profile.id}</p>
                <p className="muted">
                  加入：{date(detail.profile.created_at)} · 可用點數：
                  {detail.profile.credits}
                </p>
              </div>
              <button
                className="secondary"
                onClick={() =>
                  exportCSV(
                    detail.attempts.map((a) => ({
                      任務: a.mission_id,
                      階段: stateLabel[stage(a)],
                      反思:
                        detail.reflections.find((r) => r.attempt_id === a.id)
                          ?.body ?? "",
                      開始: a.created_at,
                      完成: a.completed_at,
                    })),
                    `player-${detail.profile.id}.csv`,
                  )
                }
              >
                匯出任務與反思
              </button>
            </div>
            <div className="level-strip">
              {families.map((f) => (
                <span className="pill" key={f}>
                  {f} · Lv.
                  {level(
                    detail.attempts.filter(
                      (a) =>
                        a.state === "completed" &&
                        missions.find((m) => m.id === a.mission_id)?.family ===
                          f,
                    ).length,
                  )}
                </span>
              ))}
            </div>
          </section>
          <h2>任務與輸入</h2>
          {detail.attempts.map((a) => (
            <section className="panel" key={a.id}>
              <div className="row between">
                <h3>
                  {missions.find((m) => m.id === a.mission_id)?.title ||
                    a.mission_id}
                </h3>
                <span className="pill">{stateLabel[stage(a)]}</span>
              </div>
              <p className="small muted">
                開始 {date(a.created_at)}
                {a.completed_at && ` · 完成 ${date(a.completed_at)}`}
              </p>
              <p className="preserve">
                {detail.reflections.find((r) => r.attempt_id === a.id)?.body ||
                  "尚未提交反思"}
              </p>
            </section>
          ))}
          {!detail.attempts.length && <p className="empty">還未開始任務。</p>}
          <h2>玩家回饋</h2>
          {detail.feedback.map((f, i) => (
            <section className="panel" key={i}>
              <small>{date(f.created_at)}</small>
              <p className="preserve">{f.body}</p>
            </section>
          ))}
          {!detail.feedback.length && <p className="muted">尚未提交回饋。</p>}
          <h2>卡牌與兌換</h2>
          <p>
            現有卡牌 {detail.cards.length} 張，其中{" "}
            {detail.cards.filter((c) => c.sealed_at).length} 張已封存。
          </p>
          {detail.cards.map((c) => (
            <p className="small break" key={c.id}>
              {c.mission_id} · {c.sealed_at ? "已封存" : "可交換"} · {c.id}
            </p>
          ))}
          {detail.redemptions.map((r) => (
            <section className="panel" key={r.id}>
              <h3>{rewards.find((x) => x.id === r.reward_id)?.title}</h3>
              <p>
                {r.fulfilled_at
                  ? `已領取：${date(r.fulfilled_at)}`
                  : "尚未領取"}{" "}
                · {r.cost} 點
              </p>
            </section>
          ))}
        </>
      )}
      {tab === "manage" && (
        <div className="management">
          <section className="panel">
            <h2>新增任務</h2>
            <p className="small muted">
              新增同家族任務可讓玩家繼續升級至
              Lv.10。已建立任務只可切換開放狀態，以保留歷史規則。
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget,
                  d = new FormData(form);
                void act(async () => {
                  await rpc("admin_save_mission", {
                    p_id: String(d.get("id")).toUpperCase(),
                    p_title: d.get("title"),
                    p_family: d.get("family"),
                    p_description: d.get("description"),
                    p_question: d.get("question"),
                    p_rarity: d.get("rarity"),
                    p_duo: d.get("duo") === "on",
                    p_supply: d.get("supply") ? Number(d.get("supply")) : null,
                    p_active: true,
                  });
                  form.reset();
                });
              }}
            >
              <div className="form-grid">
                <label>
                  任務 ID
                  <input
                    name="id"
                    required
                    pattern="[A-Za-z0-9_-]{3,30}"
                    maxLength={30}
                  />
                </label>
                <label>
                  任務名稱
                  <input name="title" required maxLength={100} />
                </label>
                <label>
                  家族
                  <select name="family">
                    {families.map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                </label>
                <label>
                  稀有度
                  <select name="rarity">
                    {["Common", "Rare", "Epic", "Legendary"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                任務內容
                <textarea name="description" required maxLength={2000} />
              </label>
              <label>
                反思問題
                <input name="question" required maxLength={500} />
              </label>
              <label>
                卡牌總額度（留空不限）
                <input name="supply" type="number" min={1} />
              </label>
              <label className="checkbox">
                <input type="checkbox" name="duo" />
                需要另一位同學見證
              </label>
              <button className="primary" disabled={busy}>
                建立任務
              </button>
            </form>
          </section>
          <section className="panel">
            <h2>獎勵與核銷</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget,
                  d = new FormData(form);
                void act(async () => {
                  await rpc("admin_save_reward", {
                    p_title: d.get("title"),
                    p_cost: Number(d.get("cost")),
                    p_stock: Number(d.get("stock")),
                  });
                  form.reset();
                });
              }}
            >
              <label>
                獎勵名稱
                <input name="title" required maxLength={100} />
              </label>
              <div className="form-grid">
                <label>
                  所需點數
                  <input name="cost" type="number" required min={1} />
                </label>
                <label>
                  庫存
                  <input name="stock" type="number" required min={0} />
                </label>
              </div>
              <button className="primary" disabled={busy}>
                新增獎勵
              </button>
            </form>
            <hr />
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget,
                  d = new FormData(form);
                void act(async () => {
                  await rpc("fulfill_reward", { p_code: d.get("code") });
                  form.reset();
                }, "已核銷，可交付獎勵");
              }}
            >
              <h3>確認玩家領取</h3>
              <label>
                玩家兌換碼
                <input name="code" required pattern="[0-9a-fA-F-]{36}" />
              </label>
              <button className="secondary" disabled={busy}>
                核銷一次
              </button>
            </form>
            {rewards.map((r) => (
              <div className="reward-admin" key={r.id}>
                <p>
                  {r.title} · {r.cost} 點 · 庫存 {r.stock}
                </p>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    void act(() =>
                      rpc("admin_reward_active", {
                        p_id: r.id,
                        p_active: !r.active,
                      }),
                    )
                  }
                >
                  {r.active ? "停止兌換" : "開放兌換"}
                </button>
              </div>
            ))}
          </section>
          <section className="panel full">
            <h2>任務管理與 QR Code</h2>
            <div className="mission-grid">
              {missions.map((m) => (
                <article className="mini-panel" key={m.id}>
                  <span className="eyebrow">
                    {m.id} · {m.family}
                  </span>
                  <h3>{m.title}</h3>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      void act(() =>
                        rpc("admin_save_mission", {
                          p_id: m.id,
                          p_title: m.title,
                          p_family: m.family,
                          p_description: m.description,
                          p_question: m.question,
                          p_rarity: m.rarity,
                          p_duo: m.duo,
                          p_supply: m.supply,
                          p_active: !m.active,
                        }),
                      )
                    }
                  >
                    {m.active ? "暫停新預留" : "重新開放"}
                  </button>
                  <QR
                    value={`${location.origin}/?mission=${m.id}`}
                    label="下載任務 QR Code"
                  />
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
