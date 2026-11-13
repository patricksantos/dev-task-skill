import { XMLParser } from "fast-xml-parser";
import { sanitizeText } from "@/sanitize/sanitize";
import type { ScenarioStatus } from "@/types";

export interface ParsedCase {
  name: string;
  file: string | null;
  status: ScenarioStatus;
  timeSeconds: number;
  timestamp: string | null;
  failure: string | null;
}

export interface ParsedJunit {
  name: string;
  device: string | null;
  tests: number;
  failures: number;
  timeSeconds: number;
  cases: ParsedCase[];
}

export class JunitParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JunitParseError";
  }
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: true,
});

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function textOf(node: unknown): string | null {
  if (node == null) return null;
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) {
    const parts = node.map((item) => textOf(item)).filter((item): item is string => Boolean(item));
    return parts.length ? parts.join("\n") : null;
  }
  if (typeof node === "object" && node && "#text" in node) {
    return textOf((node as { "#text": unknown })["#text"]);
  }
  return null;
}

function attribute(node: Record<string, unknown>, name: string): string | null {
  const value = node[`@_${name}`];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return null;
}

function mapStatus(status: string | null, failure: string | null): ScenarioStatus {
  if (failure) return "failed";
  const value = (status ?? "").toUpperCase();
  if (value === "SUCCESS" || value === "PASSED" || value === "PASS") return "passed";
  if (value === "ERROR" || value === "FAILURE" || value === "FAILED" || value === "FAIL") return "failed";
  if (value === "SKIPPED" || value === "IGNORED" || value === "SKIP") return "skipped";
  return "passed";
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function parseJunit(xml: string): ParsedJunit {
  let document: unknown;
  try {
    document = parser.parse(xml);
  } catch {
    throw new JunitParseError("Relatório JUnit ilegível.");
  }
  const root = document as { testsuites?: { testsuite?: unknown } };
  const suites = asArray(root.testsuites?.testsuite as Record<string, unknown> | Record<string, unknown>[]);
  if (!suites.length) throw new JunitParseError("Relatório JUnit sem suíte.");

  const cases: ParsedCase[] = [];
  let device: string | null = null;
  let name = "Test Suite";
  let tests = 0;
  let failures = 0;
  let timeSeconds = 0;

  for (const suite of suites) {
    device = device ?? attribute(suite, "device");
    name = attribute(suite, "name") ?? name;
    tests += Number(attribute(suite, "tests") ?? 0);
    failures += Number(attribute(suite, "failures") ?? 0);
    timeSeconds += Number(attribute(suite, "time") ?? 0);
    for (const testcase of asArray(suite.testcase as Record<string, unknown> | Record<string, unknown>[])) {
      const failure = sanitizeText(textOf(testcase.failure) ?? "").trim() || null;
      const caseName = attribute(testcase, "name") ?? attribute(testcase, "id") ?? attribute(testcase, "classname");
      if (!caseName) continue;
      cases.push({
        name: caseName,
        file: attribute(testcase, "file"),
        status: mapStatus(attribute(testcase, "status"), failure),
        timeSeconds: Number(attribute(testcase, "time") ?? 0),
        timestamp: attribute(testcase, "timestamp"),
        failure,
      });
    }
  }

  return { name, device, tests: tests || cases.length, failures, timeSeconds, cases };
}

export function renderJunit(report: ParsedJunit): string {
  const cases = report.cases
    .map((item) => {
      const failure = item.failure ? `\n      <failure>${escapeXml(item.failure)}</failure>` : "";
      const file = item.file ? ` file="${escapeXml(item.file)}"` : "";
      const timestamp = item.timestamp ? ` timestamp="${escapeXml(item.timestamp)}"` : "";
      return `    <testcase id="${escapeXml(item.name)}" name="${escapeXml(item.name)}" classname="${escapeXml(item.name)}"${file} time="${item.timeSeconds}"${timestamp} status="${item.status === "failed" ? "ERROR" : item.status === "skipped" ? "SKIPPED" : "SUCCESS"}">${failure}${failure ? "\n    " : ""}</testcase>`;
    })
    .join("\n");
  const device = report.device ? ` device="${escapeXml(report.device)}"` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="${escapeXml(report.name)}"${device} tests="${report.cases.length}" failures="${report.cases.filter((item) => item.status === "failed").length}" time="${report.timeSeconds}">
${cases}
  </testsuite>
</testsuites>
`;
}

export function sanitizeJunitDocument(xml: string): { xml: string; report: ParsedJunit } {
  const report = parseJunit(xml);
  return { xml: renderJunit(report), report };
}
