import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { applyMaestroLine } from "@/parser/maestro-parser";
import { parseJunit } from "@/junit/junit-report";
import { reconcileScenarios } from "@/runner/reconcile";
import type { ScenarioView } from "@/types";

const fixtures = path.resolve(process.cwd(), "fixtures");

function pending(name: string, file: string): ScenarioView {
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
    sortOrder: 0,
  };
}

test("a saída simulada não confirma resultado antes do JUnit", () => {
  const lines = fs.readFileSync(path.join(fixtures, "smoke-mixed.log"), "utf8").split(/\r?\n/);
  const scenarios = [
    pending("home", ".maestro/flows/smoke/home.yaml"),
    pending("home_to_stores", ".maestro/flows/smoke/home_to_stores.yaml"),
    pending("home_to_coupons", ".maestro/flows/smoke/home_to_coupons.yaml"),
    pending("return_home", ".maestro/flows/smoke/return_home.yaml"),
  ];
  let failedScenario: string | null = null;
  let storesCommand: string | null = null;
  for (const line of lines) {
    const effect = applyMaestroLine(line, scenarios, "2026-11-12T13:00:00.000Z");
    if (line.includes("FAILED")) failedScenario = effect.scenarioName;
    if (line.includes("Tap on")) storesCommand = effect.scenarioName;
  }
  assert.equal(failedScenario, "home_to_coupons");
  assert.equal(storesCommand, "home_to_stores");

  const stores = scenarios.find((scenario) => scenario.name === "home_to_stores");
  const coupons = scenarios.find((scenario) => scenario.name === "home_to_coupons");
  assert.equal(stores?.status, "running");
  assert.equal(stores?.logSignal, "passed");
  assert.equal(stores?.confirmed, false);
  assert.equal(coupons?.logSignal, "failed");
  assert.equal(coupons?.status, "running");
  assert.equal(coupons?.confirmed, false);
  assert.match(coupons?.logError ?? "", /Element not found/);

  const junit = parseJunit(fs.readFileSync(path.join(fixtures, "smoke-mixed.xml"), "utf8"));
  const confirmed = reconcileScenarios(scenarios, junit, {
    exitCode: 1,
    aborted: false,
    finishedAt: "2026-11-12T13:00:12.000Z",
  });
  assert.equal(confirmed.find((scenario) => scenario.name === "home_to_stores")?.status, "passed");
  assert.equal(confirmed.find((scenario) => scenario.name === "home_to_coupons")?.status, "failed");
  assert.match(confirmed.find((scenario) => scenario.name === "home_to_coupons")?.errorMessage ?? "", /\[redacted-email\]/);
  assert.equal((confirmed.find((scenario) => scenario.name === "home_to_coupons")?.errorMessage ?? "").includes("user@example.com"), false);
});

test("o formato em caixa do Maestro só altera o sinal do log", () => {
  const lines = fs.readFileSync(path.join(fixtures, "box-flow.log"), "utf8").split(/\r?\n/);
  const scenarios = [pending("home", ".maestro/flows/smoke/home.yaml")];
  let device: string | null = null;
  for (const line of lines) {
    const effect = applyMaestroLine(line, scenarios, "2026-11-12T13:00:00.000Z");
    if (effect.deviceName) device = effect.deviceName;
  }
  assert.match(device ?? "", /iPhone 16 Plus/);
  assert.equal(scenarios[0]?.status, "running");
  assert.equal(scenarios[0]?.logSignal, "failed");
  assert.match(scenarios[0]?.command ?? "", /Restaurantes/);
  assert.equal(scenarios[0]?.confirmed, false);
});
