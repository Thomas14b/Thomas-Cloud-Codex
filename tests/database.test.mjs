import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const alice = "11111111-1111-4111-8111-111111111111",
  bob = "22222222-2222-4222-8222-222222222222",
  carol = "33333333-3333-4333-8333-333333333333",
  admin = "99999999-9999-4999-8999-999999999999";
async function root() {
  await db.exec("reset role");
}
async function user(id, role = "authenticated") {
  await root();
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec(`set role ${role}`);
}
async function scalar(sql, args = []) {
  return Object.values((await db.query(sql, args)).rows[0])[0];
}
async function reserve(m) {
  return scalar("select reserve_mission($1)", [m]);
}
async function submit(id, body = "試過就有新發現") {
  await db.query("select submit_attempt($1,$2)", [id, body]);
}
async function solo(player, m = "HK027") {
  await user(player);
  const id = await reserve(m);
  await submit(id);
  return scalar("select id from cards where attempt_id=$1", [id]);
}
before(async () => {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;grant usage on schema auth,public to anon,authenticated,service_role;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
  for (const file of (await readdir("supabase/migrations")).sort())
    await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
  for (const [id, name] of [
    [alice, "Alice"],
    [bob, "Bob"],
    [carol, "Carol"],
    [admin, "Admin"],
  ])
    await db.query(
      "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)",
      [id, `${name}@example.test`, { display_name: name }],
    );
  await db.query("update profiles set is_admin=true where id=$1", [admin]);
});
after(async () => db.close());
let aliceCard, bobCard;
test("signup creates profile; players cannot elevate privileges or mint cards", async () => {
  await user(alice);
  assert.equal(await scalar("select count(*) from profiles"), 1);
  await assert.rejects(
    db.exec("update profiles set is_admin=true"),
    /permission denied/,
  );
  await assert.rejects(
    db.exec(
      "insert into cards(mission_id,owner_id,attempt_id) values('HK027',gen_random_uuid(),gen_random_uuid())",
    ),
    /permission denied/,
  );
  await assert.rejects(
    db.exec("select finish_attempt(gen_random_uuid())"),
    /permission denied/,
  );
  await assert.rejects(
    db.query("select claim_ai_quota($1)", [alice]),
    /permission denied/,
  );
});
test("single mission is idempotent; credits awarded once and reflection remains private to peers", async () => {
  aliceCard = await solo(alice);
  const id = await reserve("HK027");
  await submit(id);
  assert.equal(await scalar("select credits from profiles"), 100);
  assert.equal(await scalar("select count(*) from cards"), 1);
  await user(bob);
  assert.equal(await scalar("select count(*) from reflections"), 0);
  assert.equal(await scalar("select count(*) from attempts"), 0);
  await assert.rejects(submit(id), /沒有權限/);
});
test("duo completion requires another authenticated witness and never reveals reflection", async () => {
  await user(alice);
  const id = await reserve("HK006");
  await submit(id, "管理員可讀取這段反思");
  const invite = await scalar("select invite from attempts where id=$1", [id]);
  await assert.rejects(
    db.query("select verify_attempt($1,true)", [invite]),
    /另一位/,
  );
  await user(bob);
  const preview = await scalar("select witness_preview($1)", [invite]);
  assert.equal(preview.player, "Alice");
  assert.equal(preview.body, undefined);
  await db.query("select verify_attempt($1,true)", [invite]);
  await assert.rejects(
    db.query("select verify_attempt($1,true)", [invite]),
    /已處理/,
  );
  await user(alice);
  assert.equal(await scalar("select credits from profiles"), 200);
});
test("limited reservations cannot oversubscribe; expired and rejected reservations can be reclaimed", async () => {
  await root();
  await db.exec(
    "insert into missions(id,title,family,description,question,rarity,duo,supply) values('TEST1','限量測試','敢問雞','內容','問題','Rare',true,1)",
  );
  await user(alice);
  const id = await reserve("TEST1");
  await user(bob);
  await assert.rejects(reserve("TEST1"), /額度/);
  await root();
  await db.query(
    "update attempts set expires_at=now()-interval '1 second' where id=$1",
    [id],
  );
  await user(alice);
  await assert.rejects(submit(id), /到期/);
  await user(bob);
  const next = await reserve("TEST1");
  await submit(next);
  const invite = await scalar("select invite from attempts where id=$1", [
    next,
  ]);
  await user(carol);
  await db.query("select verify_attempt($1,false)", [invite]);
  await user(alice);
  assert.equal(await reserve("TEST1"), id);
});
test("trade locks cards, only intended recipient can accept, replay is rejected", async () => {
  bobCard = await solo(bob, "HK065");
  await user(alice);
  const trade = await scalar("select offer_trade($1,$2)", [aliceCard, bobCard]);
  await assert.rejects(
    db.query("select seal_card($1)", [aliceCard]),
    /取消交換/,
  );
  await assert.rejects(
    db.query("select offer_trade($1,$2)", [aliceCard, bobCard]),
    /待處理/,
  );
  await assert.rejects(
    db.query("select resolve_trade($1,true)", [trade]),
    /收件人/,
  );
  await user(carol);
  await assert.rejects(
    db.query("select resolve_trade($1,true)", [trade]),
    /沒有權限/,
  );
  await user(bob);
  await db.query("select resolve_trade($1,true)", [trade]);
  await assert.rejects(
    db.query("select resolve_trade($1,true)", [trade]),
    /已處理/,
  );
  assert.equal(
    await scalar("select owner_id from cards where id=$1", [aliceCard]),
    bob,
  );
  await db.query("select seal_card($1)", [aliceCard]);
  await assert.rejects(
    db.query("select offer_trade($1,$2)", [aliceCard, bobCard]),
    /封存/,
  );
});
test("rewards debit once, prevent insufficient credit and duplicate fulfillment", async () => {
  await root();
  const reward = await scalar(
    "insert into rewards(title,cost,stock) values('貼紙',100,1) returning id",
  );
  await user(carol);
  await assert.rejects(
    db.query("select redeem_reward($1)", [reward]),
    /點數不足/,
  );
  await user(alice);
  const code = await scalar("select redeem_reward($1)", [reward]);
  assert.equal(await scalar("select redeem_reward($1)", [reward]), code);
  assert.equal(await scalar("select credits from profiles"), 100);
  await user(bob);
  await assert.rejects(db.query("select redeem_reward($1)", [reward]), /換完/);
  await assert.rejects(db.query("select fulfill_reward($1)", [code]), /管理員/);
  await user(admin);
  await db.query("select fulfill_reward($1)", [code]);
  await assert.rejects(db.query("select fulfill_reward($1)", [code]), /已核銷/);
});
test("dashboard restricted to admins; reflections visible, AI conversations excluded", async () => {
  await user(alice);
  await db.query("select send_feedback($1)", ["好想有更多任務"]);
  await assert.rejects(db.exec("select admin_overview()"), /管理員/);
  await root();
  await db.query(
    "insert into chat_messages(player_id,role,content) values($1,'user','private chat')",
    [alice],
  );
  await user(admin);
  assert.equal(await scalar("select count(*) from chat_messages"), 0);
  const detail = await scalar("select admin_player_detail($1)", [alice]);
  assert.equal(detail.profile.email, "Alice@example.test");
  assert.equal(detail.feedback.length, 1);
  assert.ok(detail.reflections.length >= 2);
  assert.equal(detail.chat_messages, undefined);
  const overview = await scalar("select admin_overview()");
  assert.equal(overview.players, 3);
  assert.equal(overview.activity.length, 14);
  const list = await scalar("select admin_players('Alice','completed',0)");
  assert.equal(list.total, 1);
  const inputs = await scalar("select admin_inputs('feedback','更多',0)");
  assert.equal(inputs.total, 1);
});
test("service-only quota enforces daily cap; owner can clear own chat only", async () => {
  await user(alice, "service_role");
  for (let i = 0; i < 20; i++)
    await db.query("select claim_ai_quota($1)", [alice]);
  await assert.rejects(
    db.query("select claim_ai_quota($1)", [alice]),
    /每日 20/,
  );
  await user(bob);
  await db.exec("select clear_chat()");
  await user(alice);
  assert.equal(await scalar("select count(*) from chat_messages"), 1);
  await db.exec("select clear_chat()");
  assert.equal(await scalar("select count(*) from chat_messages"), 0);
});
test("anonymous callers cannot reserve or read player data", async () => {
  await user("", "anon");
  await assert.rejects(
    db.exec("select reserve_mission('HK027')"),
    /permission denied/,
  );
  await assert.rejects(db.exec("select * from profiles"), /permission denied/);
});
