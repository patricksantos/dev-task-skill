import assert from "node:assert/strict";
import test from "node:test";
import type { PrerequisiteCheck, ScenarioView } from "@/types";
import {
  boardIndicators,
  classifyFlow,
  commandSteps,
  executionProgress,
  filterHistory,
  filterLogs,
  filterScenarios,
  foldLiveEvent,
  historySummary,
  isLiveScenario,
  isFailureLine,
  maestroCommandName,
  prereqSummary,
  recurringFailures,
  runnerLabel,
  successLabel,
} from "@/components/view-model";

function scenario(partial: Partial<ScenarioView> & Pick<ScenarioView, "name" | "status">): ScenarioView {
  return {
    file: null,
    module: "smoke",
    logSignal: "none",
    command: null,
    logError: null,
    errorMessage: null,
    startedAt: null,
    finishedAt: null,
    durationMs: null,
    confirmed: false,
    sortOrder: 0,
    ...partial,
  };
}

const checks = (hmlOk: boolean, simulatorOk = true): PrerequisiteCheck[] => [
  { id: "maestro", label: "Maestro", ok: true, level: "required", message: "" },
  { id: "scripts", label: "Scripts", ok: true, level: "required", message: "" },
  { id: "simulator", label: "Simulador", ok: simulatorOk, level: "required", message: "" },
  { id: "hml", label: "API HML", ok: hmlOk, level: "warning", message: "" },
];

test("o progresso usa só cenários confirmados, não o tempo", () => {
  const progress = executionProgress([
    scenario({ name: "home", status: "running", confirmed: false, command: "Launch app", sortOrder: 0 }),
    scenario({ name: "home_to_stores", status: "pending", sortOrder: 1 }),
  ]);
  assert.equal(progress.confirmed, 0);
  assert.equal(progress.ratio, 0);
  assert.equal(progress.currentName, "home");
  assert.equal(progress.currentCommand, "Launch app");

  const done = executionProgress([
    scenario({ name: "home", status: "passed", confirmed: true, sortOrder: 0 }),
    scenario({ name: "home_to_stores", status: "failed", confirmed: true, sortOrder: 1 }),
  ]);
  assert.equal(done.confirmed, 2);
  assert.equal(done.ratio, 1);
  assert.equal(done.currentName, null);
});

test("filtros de cenário, log e histórico não misturam demonstração com execução real", () => {
  const scenarios = [
    scenario({ name: "home", status: "passed", module: "smoke", confirmed: true }),
    scenario({ name: "listing", status: "failed", module: "stores", confirmed: true }),
  ];
  assert.deepEqual(filterScenarios(scenarios, "stores", "all").map((item) => item.name), ["listing"]);
  assert.deepEqual(filterScenarios(scenarios, "all", "passed").map((item) => item.name), ["home"]);

  const logs = filterLogs(
    [
      { id: 1, runId: "a", scenarioName: "home", stream: "stdout", ts: "", line: "Launch app... COMPLETED", command: null },
      { id: 2, runId: "a", scenarioName: "home", stream: "stderr", ts: "", line: "Authorization: [redacted]", command: null },
      { id: 3, runId: "a", scenarioName: "listing", stream: "stdout", ts: "", line: "Assertion is false: Restaurantes", command: null },
    ],
    { stream: "stdout", query: "assertion", scenario: null },
  );
  assert.deepEqual(logs.map((entry) => entry.id), [3]);
  assert.equal(isFailureLine("Assert that \"Restaurantes\" is visible... FAILED", "stdout"), true);
  assert.equal(isFailureLine("Launch app... COMPLETED", "stdout"), false);

  const history = filterHistory(
    [
      { mode: "script" },
      { mode: "fixture" },
    ] as never,
    "real",
  );
  assert.equal(history.length, 1);
  assert.equal(history[0]?.mode, "script");
});

test("o catálogo separa a suíte completa, o que fica de fora e o bloqueio de pré-requisito", () => {
  assert.equal(classifyFlow({ name: "category_tabs", module: "coupons", suites: [] }, checks(true)).availability, "available");
  assert.equal(classifyFlow({ name: "category_tabs", module: "coupons", suites: ["coupons"] }, checks(true)).availability, "available");
  assert.equal(classifyFlow({ name: "home", module: "smoke", suites: ["smoke", "all"] }, checks(false)).availability, "included");
  assert.equal(classifyFlow({ name: "home", module: "smoke", suites: ["smoke", "all"] }, checks(true)).reason, "Incluído na suíte completa.");
  assert.equal(classifyFlow({ name: "listing", module: "stores", suites: ["stores", "all"] }, checks(false)).availability, "blocked");
  assert.equal(classifyFlow({ name: "home_to_stores", module: "smoke", suites: ["smoke", "all"] }, checks(false)).availability, "blocked");
  assert.equal(classifyFlow({ name: "home", module: "smoke", suites: ["smoke", "all"] }, checks(true, false)).availability, "blocked");
  assert.equal(prereqSummary(null).label, "Verificando");
  assert.equal(runnerLabel(null, false).label, "Pronto");
  assert.equal(runnerLabel({ status: "running", mode: "fixture", suiteLabel: "Smoke" } as never, false).tone, "demo");
});

test("indicadores, comandos e eventos ficam no mesmo run", () => {
  const home = scenario({ name: "home", status: "passed", confirmed: true, sortOrder: 0 });
  const coupons = scenario({ name: "home_to_coupons", status: "failed", confirmed: true, sortOrder: 1, errorMessage: "Cupons" });
  const running = scenario({ name: "return_home", status: "running", sortOrder: 2, logSignal: "running" });
  assert.equal(isLiveScenario([home, coupons, running], running), true);
  assert.equal(isLiveScenario([home, coupons, running], home), false);
  assert.equal(successLabel("running", [home, coupons, running]), "—");
  assert.equal(successLabel("failed", [home, coupons]), "50%");
  assert.equal(successLabel("passed", []), "—");
  assert.equal(successLabel("aborted", [home]), "—");
  assert.equal(boardIndicators({ status: "failed" } as never, [home, coupons]).failed, 1);
  assert.equal(boardIndicators({ status: "failed" } as never, [home, coupons]).passed, 1);

  const logs = commandSteps(
    [
      { id: 1, runId: "run-a", scenarioName: "home", stream: "stdout", ts: "t1", line: "Launch app... COMPLETED", command: "Launch app" },
      { id: 2, runId: "run-a", scenarioName: "home_to_coupons", stream: "stdout", ts: "t2", line: "Assert that \"Cupons\" is visible... FAILED", command: "Assert that \"Cupons\" is visible" },
      { id: 3, runId: "run-b", scenarioName: "home", stream: "stdout", ts: "t3", line: "Tap on \"Lojas\"... FAILED", command: "Tap on \"Lojas\"" },
    ],
    "home_to_coupons",
  );
  assert.equal(logs.length, 1);
  assert.equal(logs[0]?.signal, "failed");
  assert.match(logs[0]?.text ?? "", /Cupons/);

  const board = foldLiveEvent(
    { run: { id: "run-a", status: "running" } as never, scenarios: [], logs: [] },
    { type: "log", run: { id: "run-b", status: "running" } as never, log: { id: 9, runId: "run-b", scenarioName: "home", stream: "stdout", ts: "", line: "FAILED", command: null }, serverTime: "" },
  );
  assert.equal(board.logs.length, 0);
  const snapped = foldLiveEvent(board, {
    type: "snapshot",
    run: { id: "run-a", status: "running" } as never,
    scenarios: [home],
    logs: [
      { id: 1, runId: "run-a", scenarioName: "home", stream: "stdout", ts: "", line: "ok", command: null },
      { id: 2, runId: "run-b", scenarioName: "home", stream: "stdout", ts: "", line: "outro", command: null },
    ],
    serverTime: "",
  });
  assert.deepEqual(snapped.logs.map((entry) => entry.id), [1]);
  assert.equal(snapped.scenarios[0]?.name, "home");
});

test("o resumo real soma ignorados e deixa a demonstração de fora", () => {
  assert.equal(maestroCommandName('Launch app "com.example.app"'), "launchApp");
  assert.equal(maestroCommandName('Assert that "Cupons" is visible'), "assertVisible");
  assert.equal(maestroCommandName("Waiting for flows to complete..."), null);

  const real = {
    id: "real",
    mode: "script",
    status: "failed",
    passedCount: 25,
    failedCount: 5,
    skippedCount: 2,
    abortedCount: 0,
    runningCount: 0,
    pendingCount: 0,
    totalCount: 32,
    durationMs: 4000,
    createdAt: "2",
  };
  const demo = {
    id: "demo",
    mode: "fixture",
    status: "failed",
    passedCount: 0,
    failedCount: 4,
    skippedCount: 0,
    abortedCount: 0,
    runningCount: 0,
    pendingCount: 0,
    totalCount: 4,
    durationMs: 1000,
    createdAt: "1",
  };
  const summary = historySummary([real, demo] as never);
  assert.equal(summary.basis, "real");
  assert.equal(summary.passed, 25);
  assert.equal(summary.failed, 5);
  assert.equal(summary.skipped, 2);
  assert.equal(summary.tests, 32);
  assert.equal(summary.passed + summary.failed + summary.skipped + summary.aborted + summary.running + summary.pending, summary.tests);
  assert.equal(summary.success, "83.3%");
  assert.equal(summary.latest.length, 1);
  assert.equal(summary.last?.id, "real");

  const onlyDemo = historySummary([demo] as never);
  assert.equal(onlyDemo.basis, "empty");
  assert.equal(onlyDemo.tests, 0);
  assert.equal(onlyDemo.success, "—");
  assert.equal(onlyDemo.last, null);

  assert.deepEqual(recurringFailures(["home_to_coupons", "home", "home_to_coupons"]), [{ name: "home_to_coupons", count: 2 }]);
});
