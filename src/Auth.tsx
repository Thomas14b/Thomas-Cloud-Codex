import { useEffect, useState } from "react";
import {
  signup,
  login,
  requestPasswordRecovery,
  updateUser,
  getSettings,
  oauthLogin,
  acceptInvite,
  type Settings,
  type AuthProvider,
} from "@netlify/identity";
import { message } from "./data";
import { Monster } from "./Monster";
export function Auth({
  recovery = false,
  inviteToken,
  initialError = "",
  onInviteComplete,
}: {
  recovery?: boolean;
  inviteToken?: string;
  initialError?: string;
  onInviteComplete?: () => void;
}) {
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch(() =>
        setNotice(
          "Netlify Identity 尚未啟用或無法連線，請在 Netlify 專案設定啟用登入服務。",
        ),
      );
  }, []);
  const [mode, setMode] = useState<"login" | "signup" | "reset" | "recover">(
    recovery || inviteToken ? "recover" : "login",
  );
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(initialError);
  async function submit(e: React.FormEvent) {
    e.preventDefault();

    setBusy(true);
    setNotice("");
    try {
      if (inviteToken) {
        await acceptInvite(inviteToken, password);
        onInviteComplete?.();
        return;
      }
      if (mode === "signup") await signup(email, password, { full_name: name });
      else if (mode === "reset") await requestPasswordRecovery(email);
      else if (mode === "recover") await updateUser({ password });
      else await login(email, password);
      if (mode === "signup")
        setNotice("註冊已送出，請檢查電郵並確認帳戶後登入。");
      if (mode === "reset") setNotice("如帳戶存在，你將收到重設密碼郵件。");
      if (mode === "recover") {
        location.replace(location.origin);
      }
    } catch (e) {
      setNotice(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <span className="eyebrow">SCHOOL OF FAILURE / SEASON 01</span>
        <h1>
          唔使完美。
          <br />
          試過，就有故事。
        </h1>
        <p>
          每次勇敢試一試，
          <br />
          都可以養大一隻精靈。
        </p>
        <div className="mascot-group">
          <Monster index={0} size={150} />
          <Monster index={1} size={180} />
          <Monster index={5} size={130} />
        </div>
        <span className="pill">六個精靈家族 · 無限個重新開始</span>
      </section>
      <section className="panel auth-card">
        <span className="eyebrow">你的冒險，由這裡開始</span>
        <h2>
          {mode === "signup"
            ? "加入失敗學院"
            : mode === "reset"
              ? "找回你的帳戶"
              : mode === "recover"
                ? "設定新密碼"
                : "歡迎返嚟，同學。"}
        </h2>
        <p className="muted">用你的帳戶，保存每一次嘗試。</p>
        <form onSubmit={submit}>
          {mode === "signup" && (
            <label>
              同學名稱
              <input
                required
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="nickname"
              />
            </label>
          )}
          {mode !== "recover" && (
            <label>
              電郵
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </label>
          )}
          {mode !== "reset" && (
            <label>
              密碼
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
              />
            </label>
          )}
          <button disabled={busy} className="primary wide">
            {busy
              ? "處理中…"
              : mode === "login"
                ? "登入，繼續冒險"
                : mode === "signup"
                  ? "建立帳戶"
                  : mode === "reset"
                    ? "寄出重設連結"
                    : "儲存新密碼"}
          </button>
        </form>
        <p role="status">{notice}</p>
        {!recovery && !inviteToken && (
          <div className="row">
            <button
              className="text-button"
              disabled={
                !settings || (settings.disableSignup && mode !== "signup")
              }
              onClick={() => {
                setMode(
                  mode === "signup" || settings?.disableSignup
                    ? "login"
                    : "signup",
                );
                setNotice("");
              }}
            >
              {mode === "signup" ? "已有帳戶？登入" : "第一次來？建立帳戶"}
            </button>
            <button
              className="text-button"
              onClick={() => setMode(mode === "reset" ? "login" : "reset")}
            >
              {mode === "reset" ? "返回登入" : "忘記密碼"}
            </button>
          </div>
        )}
        {!recovery && !inviteToken && settings && (
          <div className="row">
            {Object.entries(settings.providers)
              .filter(([provider, enabled]) => provider !== "email" && enabled)
              .map(([provider]) => (
                <button
                  key={provider}
                  className="secondary"
                  onClick={() => oauthLogin(provider as AuthProvider)}
                >
                  使用 {provider} 登入
                </button>
              ))}
          </div>
        )}
        {settings?.disableSignup && (
          <p className="small muted">
            目前採邀請制，請使用管理員提供的邀請連結。
          </p>
        )}
        <p className="small muted">
          遊戲反思與回饋可由學院管理員閱讀；波波的 AI 對話不開放給管理員。
        </p>
      </section>
    </div>
  );
}
