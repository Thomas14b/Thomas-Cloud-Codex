import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { onAuthChange, logout, getUser, type User } from "@netlify/identity";
import { initializeAuth } from "./auth-session";
type Session = { user: User };
import {
  BookOpen,
  Compass,
  MessageCircle,
  ArrowLeftRight,
  Gift,
  LayoutDashboard,
  LogOut,
  ArrowUpRight,
  Lock,
  Check,
  RefreshCw,
  Leaf,
  Send,
} from "lucide-react";
import { rpc, rows } from "./api";
import { Auth } from "./Auth";
import { Monster } from "./Monster";
const Admin = lazy(() => import("./Admin").then((m) => ({ default: m.Admin })));
import { ChatPanel } from "./Chat";
import { QR } from "./QR";
import {
  families,
  traits,
  colors,
  level,
  stage,
  stateLabel,
  message,
  date,
} from "./data";
import type {
  Mission,
  Profile,
  Attempt,
  Card,
  Trade,
  Reward,
  Redemption,
} from "./data";
type Tab = "home" | "collection" | "chat" | "trade" | "rewards" | "admin";
const nav = [
  ["home", "探索", Compass],
  ["collection", "圖鑑", BookOpen],
  ["chat", "波波", MessageCircle],
  ["trade", "交換", ArrowLeftRight],
  ["rewards", "獎勵", Gift],
] as const;
export function App() {
  const [session, setSession] = useState<Session | null>(null),
    [authReady, setAuthReady] = useState(false),
    [inviteToken, setInviteToken] = useState<string | undefined>(),
    [recovery, setRecovery] = useState(
      new URLSearchParams(location.search).has("recovery"),
    );
  const [tab, setTab] = useState<Tab>("home"),
    [profile, setProfile] = useState<Profile | null>(null),
    [missions, setMissions] = useState<Mission[]>([]),
    [attempts, setAttempts] = useState<Attempt[]>([]),
    [cards, setCards] = useState<Card[]>([]),
    [trades, setTrades] = useState<Trade[]>([]),
    [rewards, setRewards] = useState<Reward[]>([]),
    [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [selected, setSelected] = useState<string | null>(
      new URLSearchParams(location.search).get("mission"),
    ),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [reflection, setReflection] = useState(""),
    [feedback, setFeedback] = useState(""),
    [offered, setOffered] = useState(""),
    [requested, setRequested] = useState(""),
    [filter, setFilter] = useState("全部");
  const invite = new URLSearchParams(location.search).get("witness");
  const [witness, setWitness] = useState<{
    title: string;
    description: string;
    player: string;
    state: string;
    expires_at: string;
    is_self: boolean;
  } | null>(null);
  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthChange((event, user) => {
      if (!active) return;
      setSession(user ? { user } : null);
      if (event === "recovery") setRecovery(true);
      if (!user) {
        setProfile(null);
        setAttempts([]);
        setCards([]);
        setTrades([]);
        setTab("home");
      }
    });
    initializeAuth()
      .then((result) => {
        if (!active) return;
        setSession(result.user ? { user: result.user } : null);
        setRecovery(result.recovery);
        setInviteToken(result.inviteToken);
      })
      .catch((e) => {
        if (active) setError(message(e));
      })
      .finally(() => {
        if (active) setAuthReady(true);
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [ps, ms, as, cs, ts, rs, ds] = await Promise.all([
        rows<Profile>("profiles"),
        rows<Mission>("missions"),
        rows<Attempt>("attempts"),
        rows<Card>("cards"),
        rows<Trade>("trades"),
        rows<Reward>("rewards"),
        rows<Redemption>("redemptions"),
      ]);
      setProfile(ps[0] ?? null);
      setMissions(ms);
      setAttempts(as);
      setCards(cs);
      setTrades(ts.sort((a, b) => b.created_at.localeCompare(a.created_at)));
      setRewards(rs);
      setRedemptions(ds);
      if (invite)
        setWitness(await rpc("witness_preview", { p_invite: invite }));
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }, [session, invite]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!session) return;
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [session, refresh]);
  async function act(fn: () => Promise<unknown>, success = "已儲存") {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      setNotice(success);
      if (await getUser()) await refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  function openMission(id: string) {
    setSelected(id);
    setReflection("");
    setTab("home");
    history.replaceState(null, "", `?mission=${encodeURIComponent(id)}`);
  }
  function navigate(t: Tab) {
    setTab(t);
    setSelected(null);
    history.replaceState(null, "", "/");
  }
  const completed = attempts.filter((a) => a.state === "completed");
  const m = missions.find((x) => x.id === selected),
    a = attempts.find((x) => x.mission_id === selected);
  const myCards = cards.filter((c) => c.owner_id === session?.user.id);
  if (!authReady)
    return (
      <div className="setup" role="status">
        正在確認登入狀態…
      </div>
    );
  if (!session || recovery || inviteToken)
    return (
      <Auth
        recovery={recovery}
        inviteToken={inviteToken}
        initialError={error}
        onInviteComplete={() => setInviteToken(undefined)}
      />
    );
  return (
    <div className="shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate("home");
          }}
        >
          <img src="/icon.svg" alt="" width="42" height="42" />
          <span>
            失敗學院<small>FAILURE MONSTERS</small>
          </span>
        </a>
        <span className="season">SEASON 01 · 勇敢練習中</span>
        <nav aria-label="主導覽">
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              className={tab === id ? "nav-item active" : "nav-item"}
              onClick={() => navigate(id)}
            >
              <Icon size={20} />
              {label}
              {id === "chat" && <span className="ai-tag">AI</span>}
            </button>
          ))}
          {profile?.is_admin && (
            <button
              className={tab === "admin" ? "nav-item active" : "nav-item"}
              onClick={() => navigate("admin")}
            >
              <LayoutDashboard size={20} />
              管理儀表板
            </button>
          )}
        </nav>
        <div className="sidebar-note">
          <Leaf size={22} />
          <p>
            勇敢不是不害怕，
            <br />
            是怕也願意試一下。
          </p>
        </div>
        <button
          className="nav-item signout"
          onClick={() =>
            void act(async () => {
              await logout();
            }, "已登出")
          }
        >
          <LogOut size={18} />
          登出
        </button>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <span className="small muted">你的每次嘗試，都值得被記住。</span>
          <div className="row">
            <button
              className="icon-button"
              aria-label="重新整理"
              disabled={loading || busy}
              onClick={() => void refresh()}
            >
              <RefreshCw size={17} />
            </button>
            <span className="avatar">
              {profile?.display_name.slice(0, 1) || "同"}
            </span>
            <span>{profile?.display_name || "同學"}</span>
          </div>
        </header>
        {error && (
          <div className="alert error" role="alert">
            {error}
            <button className="text-button" onClick={() => setError("")}>
              關閉
            </button>
          </div>
        )}
        {notice && (
          <div className="alert success" role="status">
            <Check size={18} />
            {notice}
          </div>
        )}
        {loading && (
          <p className="small muted" role="status">
            同步資料中…
          </p>
        )}
        {!profile && !loading && (
          <button className="primary" onClick={() => void refresh()}>
            重試載入帳戶
          </button>
        )}
        {invite && tab === "home" && (
          <section className="panel">
            <span className="eyebrow">一起見證一次勇敢</span>
            <h2>
              {witness
                ? `${witness.player} 邀請你見證「${witness.title}」`
                : "正在檢查邀請，或邀請不存在"}
            </h2>
            {witness && (
              <>
                <p>{witness.description}</p>
                <p className="small muted">
                  只確認你親眼見證的嘗試。你不會看到對方的私人反思。有效至{" "}
                  {date(witness.expires_at)}。
                </p>
                <div className="row">
                  <button
                    className="primary"
                    disabled={
                      busy ||
                      witness.is_self ||
                      witness.state !== "pending" ||
                      new Date(witness.expires_at) < new Date()
                    }
                    onClick={() =>
                      void act(
                        () =>
                          rpc("verify_attempt", {
                            p_invite: invite,
                            p_accept: true,
                          }),
                        "已確認，你見證了一次勇敢！",
                      )
                    }
                  >
                    我見證了這次嘗試
                  </button>
                  <button
                    className="secondary"
                    disabled={
                      busy || witness.is_self || witness.state !== "pending"
                    }
                    onClick={() =>
                      void act(
                        () =>
                          rpc("verify_attempt", {
                            p_invite: invite,
                            p_accept: false,
                          }),
                        "已回覆未能確認",
                      )
                    }
                  >
                    未能確認
                  </button>
                </div>
                {witness.is_self && (
                  <p>請分享連結給另一個帳戶；你不能確認自己的任務。</p>
                )}
              </>
            )}
          </section>
        )}
        {tab === "home" && !m && (
          <>
            <div className="page-heading">
              <div>
                <span className="eyebrow">每個小小嘗試，都是新的開始</span>
                <h1>今日，想試啲咩？</h1>
                <p className="muted">不用做得最好，只要比昨天勇敢一點。</p>
              </div>
              <span className="pill">{completed.length} 次勇敢嘗試</span>
            </div>
            <section className="hero">
              <div>
                <span className="eyebrow">THE LITTLE COURAGE CLUB</span>
                <h2>
                  打開未知，
                  <br />
                  遇見另一個自己。
                </h2>
                <p>
                  抽一個小任務。帶著好奇出發，
                  <br />
                  把意外變成你的成長故事。
                </p>
                <button
                  className="primary"
                  disabled={
                    !missions.some(
                      (x) =>
                        x.active &&
                        !completed.some((a) => a.mission_id === x.id),
                    )
                  }
                  onClick={() => {
                    const list = missions.filter(
                      (x) =>
                        x.active &&
                        !completed.some((a) => a.mission_id === x.id),
                    );
                    if (list.length)
                      openMission(
                        list[Math.floor(Math.random() * list.length)].id,
                      );
                  }}
                >
                  揭開今日任務 <ArrowUpRight size={18} />
                </button>
              </div>
              <div className="hero-art">
                <div className="orbit">每次試，都算數。</div>
                <Monster index={1} size={230} />
                <span className="spark s1">✦</span>
                <span className="spark s2">✧</span>
                <span className="hero-ticket">
                  ADMIT ONE
                  <br />
                  <b>勇敢入場券</b>
                </span>
              </div>
            </section>
            <div className="stats">
              <div>
                <span>我的精靈</span>
                <strong>
                  {
                    new Set(
                      completed.map(
                        (a) =>
                          missions.find((m) => m.id === a.mission_id)?.family,
                      ),
                    ).size
                  }
                  <small> / 6 家族</small>
                </strong>
              </div>
              <div>
                <span>勇氣點數</span>
                <strong>
                  {profile?.credits ?? 0}
                  <small> 點</small>
                </strong>
              </div>
              <div>
                <span>等待朋友見證</span>
                <strong>
                  {attempts.filter((a) => stage(a) === "pending").length}
                  <small> 個任務</small>
                </strong>
              </div>
            </div>
            <div className="section-heading">
              <div>
                <h2>小任務，大發現</h2>
                <p className="muted">揀一件未試過的事，給自己一個機會。</p>
              </div>
              <label className="compact">
                篩選
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  {["全部", ...families].map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mission-grid">
              {missions
                .filter(
                  (m) => m.active && (filter === "全部" || m.family === filter),
                )
                .map((m) => {
                  const i = families.indexOf(m.family),
                    attempt = attempts.find((a) => a.mission_id === m.id);
                  return (
                    <button
                      className="mission-card"
                      key={m.id}
                      onClick={() => openMission(m.id)}
                    >
                      <div
                        className="card-art"
                        style={{ background: colors[i] + "45" }}
                      >
                        <span className="pill">
                          {m.duo ? "雙人任務" : "單人任務"}
                        </span>
                        <Monster index={i} size={135} />
                        <span className="card-number">{m.id}</span>
                      </div>
                      <div className="card-body">
                        <span className="eyebrow">
                          {m.family} · {traits[i]}
                        </span>
                        <h3>{m.title}</h3>
                        <p>{m.description}</p>
                        <div className="card-footer">
                          <span>
                            {attempt ? stateLabel[stage(attempt)] : m.rarity}
                          </span>
                          <ArrowUpRight size={19} />
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          </>
        )}
        {tab === "home" && selected && !m && !loading && (
          <section className="panel">
            <h2>找不到這個任務</h2>
            <button onClick={() => navigate("home")}>返回探索</button>
          </section>
        )}
        {tab === "home" && m && (
          <>
            <button className="text-button" onClick={() => navigate("home")}>
              ← 返回任務
            </button>
            <div className="detail-grid">
              <section className="panel mission-detail">
                <span className="pill">
                  {m.id} · {m.rarity} · {m.duo ? "雙人任務" : "單人任務"}
                </span>
                <Monster index={families.indexOf(m.family)} size={190} />
                <h1>{m.title}</h1>
                <p>{m.description}</p>
                <p className="small muted">
                  {m.supply
                    ? `全體限量 ${m.supply} 張，預留有效期 24 小時。`
                    : "普通卡不限總量。"}
                  每人每個任務只可完成一次並獲得 100 點。
                </p>
                <QR
                  value={`${location.origin}/?mission=${m.id}`}
                  label="任務 QR Code"
                />
              </section>
              <section className="panel">
                <span className="eyebrow">把過程留下來</span>
                <h2>{m.question}</h2>
                {a && <p className="pill">{stateLabel[stage(a)]}</p>}
                {(!a || ["expired", "rejected"].includes(stage(a))) && (
                  <>
                    <p>先預留名額，再出發完成任務。</p>
                    <button
                      className="primary"
                      disabled={busy || !m.active}
                      onClick={() =>
                        void act(
                          () => rpc("reserve_mission", { p_mission: m.id }),
                          "名額已預留，出發吧！",
                        )
                      }
                    >
                      開始任務
                    </button>
                  </>
                )}
                {a && stage(a) === "reserved" && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void act(
                        () =>
                          rpc("submit_attempt", {
                            p_id: a.id,
                            p_body: reflection,
                          }),
                        m.duo
                          ? "已提交，請邀請朋友見證。"
                          : "任務完成，精靈與 100 點已入帳！",
                      );
                    }}
                  >
                    <label>
                      我的感受與發現
                      <textarea
                        required
                        maxLength={4000}
                        value={reflection}
                        onChange={(e) => setReflection(e.target.value)}
                        placeholder="不必寫得漂亮，記低你真實的想法就好。"
                      />
                    </label>
                    <p className="privacy">
                      這段反思會儲存於你的帳戶，學院管理員可閱讀，用於了解學習過程。其他玩家看不到。
                    </p>
                    <button className="primary" disabled={busy}>
                      {busy ? "提交中…" : "記錄今次嘗試"}
                    </button>
                  </form>
                )}
                {a && stage(a) === "pending" && (
                  <>
                    <p>
                      請讓一起參與的朋友用自己的帳戶開啟以下連結。反思內容不會分享給朋友。
                    </p>
                    <Share value={`${location.origin}/?witness=${a.invite}`} />
                    <QR
                      value={`${location.origin}/?witness=${a.invite}`}
                      label="朋友見證 QR Code"
                    />
                    <p className="small muted">
                      邀請有效至 {date(a.expires_at)}
                    </p>
                  </>
                )}
                {a && a.state === "completed" && (
                  <>
                    <Check size={40} />
                    <h3>這次勇敢，已經被記住。</h3>
                    <button
                      className="primary"
                      onClick={() => navigate("collection")}
                    >
                      查看我的精靈
                    </button>
                  </>
                )}
              </section>
            </div>
          </>
        )}
        {tab === "collection" && (
          <>
            <div className="page-heading">
              <div>
                <span className="eyebrow">YOUR LITTLE COMPANIONS</span>
                <h1>每次嘗試，都在長大。</h1>
                <p className="muted">
                  每完成一個同家族的新任務，提升一級，最高十級。
                </p>
              </div>
            </div>
            <div className="family-grid">
              {families.map((f, i) => {
                const count = completed.filter(
                  (a) =>
                    missions.find((m) => m.id === a.mission_id)?.family === f,
                ).length;
                return (
                  <section
                    className={"panel family " + (!count ? "sleeping" : "")}
                    key={f}
                  >
                    <Monster index={i} size={140} />
                    <span className="eyebrow">{traits[i]}</span>
                    <h2>{f}</h2>
                    <p>
                      {count
                        ? `Lv.${level(count)} · ${count * 100} 成長經驗`
                        : "等待你的第一次勇敢"}
                    </p>
                    <progress
                      value={level(count)}
                      max={10}
                      aria-label={`${f} 等級`}
                    />
                  </section>
                );
              })}
            </div>
            <h2>
              我的卡牌 <span className="muted">{myCards.length}</span>
            </h2>
            {!myCards.length && (
              <Empty text="完成任務後，你的第一張卡會出現在這裡。" />
            )}
            <div className="mission-grid">
              {myCards.map((c) => (
                <section className="panel" key={c.id}>
                  <span className="pill">
                    {c.sealed_at ? "永久封存" : "可交換"}
                  </span>
                  <h3>{missions.find((m) => m.id === c.mission_id)?.title}</h3>
                  <Share value={c.id} label="卡牌 ID（交給交換對象）" />
                  <button
                    className="secondary"
                    disabled={busy || !!c.sealed_at}
                    onClick={() => {
                      if (
                        window.confirm(
                          "永久封存後不能再交換，也不能解除。確定封存？",
                        )
                      )
                        void act(
                          () => rpc("seal_card", { p_card: c.id }),
                          "卡牌已永久封存",
                        );
                    }}
                  >
                    <Lock size={16} />
                    永久封存
                  </button>
                </section>
              ))}
            </div>
          </>
        )}
        {tab === "chat" && <ChatPanel userId={session.user.id} />}
        {tab === "trade" && (
          <>
            <div className="page-heading">
              <div>
                <span className="eyebrow">
                  GOOD STORIES ARE MEANT TO BE SHARED
                </span>
                <h1>交換一段小故事。</h1>
                <p className="muted">
                  雙方確認後，卡牌才會交換。成長經驗留在原本的同學身上。
                </p>
              </div>
            </div>
            <section className="panel">
              <h2>提出交換</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void act(
                    () =>
                      rpc("offer_trade", {
                        p_offered: offered,
                        p_requested: requested,
                      }),
                    "交換邀請已送出",
                  );
                }}
              >
                <div className="form-grid">
                  <label>
                    我的卡牌
                    <select
                      required
                      value={offered}
                      onChange={(e) => setOffered(e.target.value)}
                    >
                      <option value="">選擇一張卡牌</option>
                      {myCards
                        .filter((c) => !c.sealed_at)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {missions.find((m) => m.id === c.mission_id)?.title}{" "}
                            · {c.id.slice(0, 8)}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    對方卡牌 ID
                    <input
                      required
                      pattern="[0-9a-fA-F-]{36}"
                      value={requested}
                      onChange={(e) => setRequested(e.target.value.trim())}
                      placeholder="請朋友從圖鑑複製卡牌 ID"
                    />
                  </label>
                </div>
                <button className="primary" disabled={busy}>
                  送出交換邀請 <ArrowLeftRight size={18} />
                </button>
              </form>
            </section>
            <h2>交換紀錄</h2>
            {!trades.length && <Empty text="暫時未有交換邀請。" />}
            {trades.map((t) => (
              <section className="panel" key={t.id}>
                <div className="row between">
                  <h3>
                    {t.sender_id === session.user.id
                      ? "你送出的邀請"
                      : "你收到的邀請"}
                  </h3>
                  <span className="pill">{stateLabel[t.state] || t.state}</span>
                </div>
                <p className="small break">
                  送出卡牌 {t.offered_id}
                  <br />
                  換取卡牌 {t.requested_id}
                </p>
                {t.state === "pending" && (
                  <div className="row">
                    {t.recipient_id === session.user.id && (
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={() =>
                          void act(
                            () =>
                              rpc("resolve_trade", {
                                p_trade: t.id,
                                p_accept: true,
                              }),
                            "交換已完成",
                          )
                        }
                      >
                        接受交換
                      </button>
                    )}
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        void act(
                          () =>
                            rpc("resolve_trade", {
                              p_trade: t.id,
                              p_accept: false,
                            }),
                          "交換已取消",
                        )
                      }
                    >
                      {t.recipient_id === session.user.id
                        ? "拒絕邀請"
                        : "取消邀請"}
                    </button>
                  </div>
                )}
              </section>
            ))}
          </>
        )}
        {tab === "rewards" && (
          <>
            <div className="page-heading">
              <div>
                <span className="eyebrow">
                  A LITTLE SOMETHING FOR YOUR COURAGE
                </span>
                <h1>給勇敢的你，一點獎勵。</h1>
              </div>
              <span className="pill">{profile?.credits ?? 0} 點可用</span>
            </div>
            <div className="mission-grid">
              {rewards
                .filter((r) => r.active)
                .map((r) => (
                  <section className="panel" key={r.id}>
                    <Gift size={32} />
                    <h2>{r.title}</h2>
                    <p>
                      {r.cost} 點 · 剩餘 {r.stock} 份
                    </p>
                    <button
                      className="primary"
                      disabled={
                        busy ||
                        r.stock < 1 ||
                        (profile?.credits ?? 0) < r.cost ||
                        redemptions.some((d) => d.reward_id === r.id)
                      }
                      onClick={() => {
                        if (confirm(`使用 ${r.cost} 點兌換「${r.title}」？`))
                          void act(
                            () => rpc("redeem_reward", { p_reward: r.id }),
                            "兌換成功，請向管理員出示兌換碼",
                          );
                      }}
                    >
                      兌換獎勵
                    </button>
                  </section>
                ))}
            </div>
            {!rewards.some((r) => r.active) && (
              <Empty text="管理員尚未開放獎勵；完成任務獲得的點數會保留。" />
            )}
            <h2>我的兌換紀錄</h2>
            {redemptions.map((r) => (
              <section className="panel" key={r.id}>
                <h3>{rewards.find((x) => x.id === r.reward_id)?.title}</h3>
                <p>{r.fulfilled_at ? "已領取" : "等待管理員核銷"}</p>
                <Share value={r.code} label="兌換碼" />
              </section>
            ))}
            <section className="panel">
              <h2>留一句話給學院</h2>
              <p className="muted">
                你的回饋會由學院管理員閱讀，不會公開給其他玩家。
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void act(async () => {
                    await rpc("send_feedback", { p_body: feedback });
                    setFeedback("");
                  }, "謝謝，你的回饋已送到學院");
                }}
              >
                <label>
                  我的回饋
                  <textarea
                    required
                    maxLength={4000}
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                  />
                </label>
                <button className="primary" disabled={busy}>
                  <Send size={17} />
                  送出回饋
                </button>
              </form>
            </section>
          </>
        )}
        {tab === "admin" && profile?.is_admin && (
          <Suspense fallback={<p role="status">載入管理儀表板…</p>}>
            <Admin />
          </Suspense>
        )}
        <footer>失敗學院 · 每一次嘗試，都有意義。</footer>
      </main>
      <nav className="mobile-nav" aria-label="手機導覽">
        {nav.map(([id, label, Icon]) => (
          <button
            key={id}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => navigate(id)}
          >
            <Icon size={21} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
export function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <Leaf size={28} />
      <p>{text}</p>
    </div>
  );
}
export function Share({
  value,
  label = "分享連結",
}: {
  value: string;
  label?: string;
}) {
  const [status, setStatus] = useState("");
  return (
    <div className="share">
      <label>
        {label}
        <input value={value} readOnly onFocus={(e) => e.target.select()} />
      </label>
      <button
        className="secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setStatus("已複製");
          } catch {
            setStatus("請選取上方文字複製");
          }
        }}
      >
        {status || "複製"}
      </button>
    </div>
  );
}
