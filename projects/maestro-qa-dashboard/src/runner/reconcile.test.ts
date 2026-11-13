import assert from "node:assert/strict";
import test from "node:test";
import { reconcileScenarios, suiteStatus } from "@/runner/reconcile";
import type { ScenarioView } from "@/types";

function running(): ScenarioView {
  return {
    name: "home",
    file: ".maestro/flows/smoke/home.yaml",
    module: "smoke",
    status: "running",
    logSignal: "failed",
    command: "Launch app",
    logError: "Element not found",
    errorMessage: null,
    startedAt: "2026-11-12T13:00:00.000Z",
    finishedAt: null,
    durationMs: null,
    confirmed: false,
    sortOrder: 0,
  };
}

test("código de saída 0 confirma sucesso mesmo com falha só no log", () => {
  const scenarios = reconcileScenarios([running()], null, {
    exitCode: 0,
    aborted: false,
    finishedAt: "2026-11-12T13:00:05.000Z",
  });
  assert.equal(scenarios[0]?.status, "passed");
  assert.equal(scenarios[0]?.confirmed, true);
  assert.equal(suiteStatus(scenarios, { exitCode: 0, aborted: false, finishedAt: "2026-11-12T13:00:05.000Z" }, null), "passed");
});

test("código de saída diferente de zero sem JUnit não promove o log a sucesso", () => {
  const scenario = running();
  scenario.logSignal = "passed";
  const scenarios = reconcileScenarios([scenario], null, {
    exitCode: 1,
    aborted: false,
    finishedAt: "2026-11-12T13:00:05.000Z",
  });
  assert.equal(scenarios[0]?.status, "failed");
  assert.match(scenarios[0]?.errorMessage ?? "", /sem resultado JUnit/);
});

test("suíte sem testes não inventa cenário aprovado ou reprovado", () => {
  const scenarios = reconcileScenarios([], null, {
    exitCode: 0,
    aborted: false,
    finishedAt: "2026-11-12T13:00:05.000Z",
  });
  assert.deepEqual(scenarios, []);
  assert.equal(suiteStatus(scenarios, { exitCode: 0, aborted: false, finishedAt: "2026-11-12T13:00:05.000Z" }, { name: "Test Suite", device: null, tests: 0, failures: 0, timeSeconds: 0, cases: [] }), "passed");
});

test("interrupção marca cenários em aberto como interrompidos", () => {
  const scenarios = reconcileScenarios([running()], null, {
    exitCode: null,
    aborted: true,
    finishedAt: "2026-11-12T13:00:05.000Z",
  });
  assert.equal(scenarios[0]?.status, "aborted");
  assert.equal(suiteStatus(scenarios, { exitCode: null, aborted: true, finishedAt: "2026-11-12T13:00:05.000Z" }, null), "aborted");
});
