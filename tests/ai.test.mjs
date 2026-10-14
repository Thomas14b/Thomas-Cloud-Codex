import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateBody,
  extractReply,
  askAI,
} from "../supabase/functions/bobo/handler.ts";
test("AI requires consent and valid bounded input", () => {
  assert.throws(() => validateBody({ message: "hello" }), /同意/);
  assert.throws(() => validateBody({ message: " ".repeat(5), consent: true }));
  assert.throws(() =>
    validateBody({ message: "x".repeat(2001), consent: true }),
  );
  assert.equal(
    validateBody({ message: "  今日試咗  ", consent: true }),
    "今日試咗",
  );
});
test("AI request carries bounded history and never enables provider storage", async () => {
  let body;
  const answer = await askAI(
    "test-key",
    "configured-model",
    Array.from({ length: 20 }, () => ({ role: "user", content: "old" })),
    "hi",
    async (url, init) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      body = JSON.parse(init.body);
      return Response.json({
        output: [
          { type: "message", content: [{ type: "output_text", text: "你好" }] },
        ],
      });
    },
  );
  assert.equal(answer, "你好");
  assert.equal(body.store, false);
  assert.equal(body.input.length, 13);
  assert.equal(body.model, "configured-model");
  assert.equal(body.max_output_tokens, 700);
});
test("provider errors and empty responses do not become fake successful messages", async () => {
  await assert.rejects(
    askAI("x", "y", [], "z", async () => new Response("", { status: 429 })),
    /額度/,
  );
  assert.throws(() => extractReply({ output: [] }), /有效回覆/);
});
