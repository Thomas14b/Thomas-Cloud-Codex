import { HttpError } from "./security.ts";
// This is the complete public RPC surface. Internal award/quota functions are excluded.
export const procedures: Record<string, string[]> = {
  reserve_mission: ["p_mission"],
  submit_attempt: ["p_id", "p_body"],
  witness_preview: ["p_invite"],
  verify_attempt: ["p_invite", "p_accept"],
  seal_card: ["p_card"],
  offer_trade: ["p_offered", "p_requested"],
  resolve_trade: ["p_trade", "p_accept"],
  redeem_reward: ["p_reward"],
  send_feedback: ["p_body"],
  clear_chat: [],
  admin_save_mission: [
    "p_id",
    "p_title",
    "p_family",
    "p_description",
    "p_question",
    "p_rarity",
    "p_duo",
    "p_supply",
    "p_active",
  ],
  admin_save_reward: ["p_title", "p_cost", "p_stock"],
  admin_reward_active: ["p_id", "p_active"],
  fulfill_reward: ["p_code"],
  admin_overview: [],
  admin_players: ["p_search", "p_stage", "p_page"],
  admin_player_detail: ["p_player"],
  admin_inputs: ["p_kind", "p_search", "p_page"],
};
export function rpcQuery(name: unknown, args: unknown) {
  if (typeof name !== "string" || !Object.hasOwn(procedures, name))
    throw new HttpError(404, "操作不存在");
  if (!args || typeof args !== "object" || Array.isArray(args))
    throw new HttpError(400, "操作參數無效");
  const params = args as Record<string, unknown>,
    keys = procedures[name];
  if (
    Object.keys(params).some((k) => !keys.includes(k)) ||
    keys.some((k) => !(k in params))
  )
    throw new HttpError(400, "操作參數不完整");
  return {
    sql: `select game.${name}(${keys.map((_, i) => "$" + (i + 1)).join(",")}) as result`,
    values: keys.map((k) => params[k]),
  };
}
export function readQuery(table: unknown, userId: string, page: unknown) {
  if (
    typeof page !== "number" ||
    !Number.isInteger(page) ||
    page < 0 ||
    page > 10000
  )
    throw new HttpError(400, "頁碼無效");
  const offset = page * 500;
  const queries: Record<string, { sql: string; values: unknown[] }> = {
    missions: {
      sql: "select * from game.missions order by id limit 500 offset $1",
      values: [offset],
    },
    rewards: {
      sql: "select * from game.rewards order by id limit 500 offset $1",
      values: [offset],
    },
    profiles: {
      sql: "select * from game.profiles where id=$1",
      values: [userId],
    },
    attempts: {
      sql: "select * from game.attempts where player_id=$1 order by id limit 500 offset $2",
      values: [userId, offset],
    },
    cards: {
      sql: "select * from game.cards where owner_id=$1 order by id limit 500 offset $2",
      values: [userId, offset],
    },
    redemptions: {
      sql: "select * from game.redemptions where player_id=$1 order by id limit 500 offset $2",
      values: [userId, offset],
    },
    trades: {
      sql: "select * from game.trades where sender_id=$1 or recipient_id=$1 order by id limit 500 offset $2",
      values: [userId, offset],
    },
    chat_messages: {
      sql: "select id,role,content from game.chat_messages where player_id=$1 order by id desc limit 100",
      values: [userId],
    },
  };
  if (typeof table !== "string" || !Object.hasOwn(queries, table))
    throw new HttpError(404, "資料不存在");
  return queries[table];
}
