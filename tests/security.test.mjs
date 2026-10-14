import { test } from "node:test";
import assert from "node:assert/strict";
import { rpcQuery, readQuery } from "../server/contracts.ts";
import { requireOrigin, readBody, failure } from "../server/security.ts";
test("RPC allowlist blocks internal awards, SQL injection and extra identity arguments", () => {
  for (const name of [
    "finish_attempt",
    "claim_ai_quota",
    "reserve_ai_request",
    "x);drop table profiles;--",
    "constructor",
  ])
    assert.throws(() => rpcQuery(name, {}));
  assert.throws(() => rpcQuery("clear_chat", { player_id: "victim" }));
  assert.deepEqual(
    rpcQuery("submit_attempt", { p_id: "id", p_body: "';drop table x;--" })
      .values,
    ["id", "';drop table x;--"],
  );
  assert.throws(() => readQuery("reflections", "id", 0));
  assert.throws(() => readQuery("chat_messages", "id", -1));
  assert.deepEqual(readQuery("chat_messages", "owner", 0).values, ["owner"]);
});
test("mutations require same-origin JSON and bounded objects; errors hide database details", async () => {
  const req = (origin, body = "{}") =>
    new Request("https://game.test/api/game", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body,
    });
  assert.throws(() => requireOrigin(req("https://attacker.test")));
  requireOrigin(req("https://game.test"));
  await assert.rejects(readBody(req("https://game.test", "x".repeat(24001))));
  await assert.rejects(readBody(req("https://game.test", "[]")));
  assert.deepEqual(
    await readBody(req("https://game.test", '{"kind":"read"}')),
    { kind: "read" },
  );
  assert.equal(
    (
      await failure(new Error("secret connection password")).json()
    ).error.includes("secret"),
    false,
  );
});
