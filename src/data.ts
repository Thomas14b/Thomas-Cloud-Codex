export const families = [
  "敢問雞",
  "歪歪貓",
  "隨風雀",
  "問問兔",
  "出聲鴨",
  "再嚟龜",
];
export const colors = [
  "#e7c66d",
  "#c2acd9",
  "#b5d4c2",
  "#e8b9a2",
  "#abcbdc",
  "#c6ce8e",
];
export const traits = [
  "勇敢開口",
  "擁抱不完美",
  "隨機應變",
  "保持好奇",
  "分享想法",
  "再試一次",
];
export interface Mission {
  id: string;
  title: string;
  family: string;
  description: string;
  question: string;
  rarity: string;
  duo: boolean;
  supply: number | null;
  active: boolean;
}
export interface Profile {
  id: string;
  display_name: string;
  email: string;
  credits: number;
  is_admin: boolean;
  created_at: string;
}
export interface Attempt {
  id: string;
  mission_id: string;
  player_id: string;
  state: string;
  invite: string;
  expires_at: string;
  completed_at: string | null;
  created_at: string;
}
export interface Card {
  id: string;
  mission_id: string;
  owner_id: string;
  sealed_at: string | null;
  created_at: string;
}
export interface Trade {
  id: string;
  sender_id: string;
  recipient_id: string;
  offered_id: string;
  requested_id: string;
  state: string;
  created_at: string;
}
export interface Reward {
  id: string;
  title: string;
  cost: number;
  stock: number;
  active: boolean;
}
export interface Redemption {
  id: string;
  player_id: string;
  reward_id: string;
  code: string;
  cost: number;
  fulfilled_at: string | null;
  created_at: string;
}
export interface Chat {
  id: number;
  role: "user" | "assistant";
  content: string;
}
export const stateLabel: Record<string, string> = {
  reserved: "進行中",
  pending: "等待見證",
  completed: "已完成",
  rejected: "未獲確認",
  expired: "已到期",
  accepted: "已交換",
  cancelled: "已取消",
};
export function stage(a: Attempt) {
  return ["reserved", "pending"].includes(a.state) &&
    new Date(a.expires_at) < new Date()
    ? "expired"
    : a.state;
}
export function level(completions: number) {
  return Math.min(10, completions);
}
export function date(s: string) {
  return new Date(s).toLocaleString("zh-HK");
}
export function message(e: unknown) {
  return e instanceof Error
    ? e.message
    : typeof e === "object" && e && "message" in e
      ? String(e.message)
      : "操作未完成，請稍後再試。";
}
