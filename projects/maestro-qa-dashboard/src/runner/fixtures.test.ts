import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { parseJunit } from "@/junit/junit-report";
import { applyMaestroLine } from "@/parser/maestro-parser";
import { reconcileScenarios } from "@/runner/reconcile";
import type { ScenarioView } from "@/types";

const fixtures = path.resolve(process.cwd(), "fixtures");

function pending(name: string, file: string, sortOrder: number): ScenarioView {
  return {
    name,
    file,
    module: "smoke",
    status: "pending",
    logSignal: "none",
    command: null,
    logError: null,
    errorMessage: null,
    startedAt: null,
    finishedAt: null,
    durationMs: null,
    confirmed: false,
    sortOrder,
  };
}

function replay(file: string, scenarios: ScenarioView[]): Array<{ line: string; scenarioName: string | null }> {
  return fs
    .readFileSync(path.join(fixtures, file), "utf8")
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => ({ line, scenarioName: applyMaestroLine(line, scenarios, "2026-11-12T13:00:00.000Z").scenarioName }));
}

test("a falha da demonstração mista aponta para o mesmo cenário no log e no JUnit", () => {
  const scenarios = [
    pending("home", ".maestro/flows/smoke/home.yaml", 0),
    pending("home_to_stores", ".maestro/flows/smoke/home_to_stores.yaml", 1),
    pending("home_to_coupons", ".maestro/flows/smoke/home_to_coupons.yaml", 2),
    pending("return_home", ".maestro/flows/smoke/return_home.yaml", 3),
  ];
  const attributed = replay("smoke-mixed.log", scenarios);
  const failedNames = attributed.filter((entry) => entry.line.includes("FAILED") || entry.line.includes("[Failed]")).map((entry) => entry.scenarioName);
  assert.deepEqual(failedNames, ["home_to_coupons", "home_to_coupons"]);
  assert.equal(scenarios.every((scenario) => scenario.confirmed === false), true);

  const junit = parseJunit(fs.readFileSync(path.join(fixtures, "smoke-mixed.xml"), "utf8"));
  const confirmed = reconcileScenarios(scenarios, junit, { exitCode: 1, aborted: false, finishedAt: "2026-11-12T13:00:12.000Z" });
  const failed = confirmed.filter((scenario) => scenario.status === "failed").map((scenario) => scenario.name);
  assert.deepEqual(failed, ["home_to_coupons"]);
  assert.equal(confirmed.filter((scenario) => scenario.status === "passed").length, 3);
});

test("demonstração em andamento não confirma resultado", () => {
  const scenarios = [
    pending("home", ".maestro/flows/smoke/home.yaml", 0),
    pending("home_to_stores", ".maestro/flows/smoke/home_to_stores.yaml", 1),
    pending("home_to_coupons", ".maestro/flows/smoke/home_to_coupons.yaml", 2),
  ];
  replay("in-progress.log", scenarios);
  assert.equal(scenarios.every((scenario) => scenario.confirmed === false), true);
  assert.equal(scenarios.find((scenario) => scenario.name === "home")?.logSignal, "passed");
  assert.equal(scenarios.find((scenario) => scenario.name === "home_to_coupons")?.status, "running");
  assert.equal(scenarios.find((scenario) => scenario.name === "home_to_coupons")?.logSignal, "running");
});

test("log interrompido reconciliado como abort não vira reprovação", () => {
  const scenarios = [pending("home", ".maestro/flows/smoke/home.yaml", 0), pending("home_to_stores", ".maestro/flows/smoke/home_to_stores.yaml", 1)];
  replay("aborted.log", scenarios);
  const confirmed = reconcileScenarios(scenarios, null, { exitCode: null, aborted: true, finishedAt: "2026-11-12T13:00:04.000Z" });
  assert.equal(confirmed.every((scenario) => scenario.status === "aborted" && scenario.confirmed), true);
  assert.equal(confirmed.some((scenario) => scenario.status === "failed"), false);
});
