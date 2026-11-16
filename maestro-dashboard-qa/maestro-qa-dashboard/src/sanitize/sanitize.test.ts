import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeText, stripAnsi } from "@/sanitize/sanitize";

test("remove ANSI, JWT, bearer, cookie e dados pessoais", () => {
  const raw = "\u001b[31mAuthorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyIn0.signaturevaluehere\u001b[0m user@example.com 123.456.789-09";
  const clean = sanitizeText(raw);
  assert.equal(stripAnsi("\u001b[32mOK\u001b[0m"), "OK");
  assert.equal(clean.includes("\u001b"), false);
  assert.equal(clean.includes("eyJ"), false);
  assert.match(clean, /Authorization: \[redacted\]/);
  assert.match(clean, /\[redacted-email\]/);
  assert.match(clean, /\[redacted-cpf\]/);
  assert.equal(clean.includes("user@example.com"), false);
});
