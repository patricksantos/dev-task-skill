import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PlannedFlow } from "@/catalog/catalog";
import type { SuiteId } from "@/types";

function fixturesDirectory(): string {
  const fromProject = path.join(process.cwd(), "fixtures");
  if (fs.existsSync(fromProject)) return fromProject;
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../fixtures");
}

export interface FixtureScript {
  lines: string[];
  junit: string;
  exitCode: number;
  failureMessage?: string | null;
  empty?: boolean;
}

const SMOKE_NAMES = ["home", "home_to_stores", "home_to_coupons", "return_home"];
const STORE_NAMES = ["listing", "search", "views", "state", "details"];
const INFRA_MESSAGE = "Falha de infraestrutura: o simulador não chegou a executar os fluxos.";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function readText(name: string): string {
  return fs.readFileSync(path.join(fixturesDirectory(), name), "utf8");
}

function linesOf(name: string): string[] {
  return readText(name).split(/\r?\n/).filter((line) => line.length > 0);
}

function generated(suite: SuiteId, flows: PlannedFlow[]): FixtureScript {
  const lines = [`Running on iPhone 16 Plus - iOS 18.5 - 11111111-1111-4111-8111-111111111111`];
  const cases = flows.map((flow, index) => {
    lines.push(` > Flow ${flow.name}`);
    lines.push(`Launch app "com.example.app"... COMPLETED`);
    lines.push(`Assert that "Início" is visible... COMPLETED`);
    return `    <testcase id="${escapeXml(flow.name)}" name="${escapeXml(flow.name)}" classname="${escapeXml(flow.name)}" file="${escapeXml(flow.file)}" time="${(1.2 + index / 10).toFixed(1)}" status="SUCCESS"/>`;
  });
  const junit = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="Test Suite" device="iPhone 16 Plus - iOS 18.5 - 11111111-1111-4111-8111-111111111111" tests="${flows.length}" failures="0" time="${flows.length}">
${cases.join("\n")}
  </testsuite>
</testsuites>
`;
  return { lines, junit, exitCode: 0 };
}

export function loadFixture(suite: SuiteId, flows: PlannedFlow[]): FixtureScript {
  const names = flows.map((flow) => flow.name);
  if (suite === "smoke" && names.join() === SMOKE_NAMES.join()) {
    return { lines: linesOf("smoke-mixed.log"), junit: readText("smoke-mixed.xml"), exitCode: 1 };
  }
  if (suite === "stores" && names.join() === STORE_NAMES.join()) {
    return { lines: linesOf("passed.log"), junit: readText("passed.xml"), exitCode: 0 };
  }
  if (suite === "coupons") {
    return { lines: linesOf("infra.log"), junit: "", exitCode: 1, failureMessage: INFRA_MESSAGE };
  }
  if (suite === "navigation") {
    return { lines: [], junit: readText("empty.xml"), exitCode: 0, empty: true };
  }
  return generated(suite, flows);
}
