import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { parseJunit, renderJunit, sanitizeJunitDocument } from "@/junit/junit-report";

test("lê o JUnit no formato gerado pelo Maestro e regrava sem segredo", () => {
  const xml = fs.readFileSync(path.resolve(process.cwd(), "fixtures/smoke-mixed.xml"), "utf8");
  const parsed = parseJunit(xml);
  assert.equal(parsed.cases.length, 4);
  assert.equal(parsed.cases[1]?.status, "passed");
  assert.equal(parsed.cases[2]?.status, "failed");
  assert.equal(parsed.device?.includes("11111111-1111-4111-8111-111111111111"), true);
  const sanitized = sanitizeJunitDocument(xml);
  assert.equal(sanitized.xml.includes("user@example.com"), false);
  const again = parseJunit(renderJunit(parsed));
  assert.equal(again.cases[2]?.name, "home_to_coupons");
  assert.equal(again.cases[2]?.failure?.includes("@"), false);
});

test("aceita um único testcase e status ignorado", () => {
  const parsed = parseJunit(`<?xml version="1.0"?>
    <testsuites>
      <testsuite name="Test Suite" tests="1" failures="0">
        <testcase name="listing" file=".maestro/flows/stores/listing.yaml" time="1.5" status="SKIPPED"/>
      </testsuite>
    </testsuites>`);
  assert.equal(parsed.cases[0]?.status, "skipped");
  assert.equal(parsed.cases[0]?.timeSeconds, 1.5);
});
