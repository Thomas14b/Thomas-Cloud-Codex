import { test } from "node:test";
import assert from "node:assert/strict";
import { validateBody, extractReply } from "../server/bobo.ts";
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
test("empty provider output is rejected", () => {
  assert.throws(() => extractReply({ output: [] }), /有效回覆/);
});
