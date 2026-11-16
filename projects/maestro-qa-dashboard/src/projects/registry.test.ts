import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadConfig } from "@/config";
import { ProjectRegistry } from "@/projects/registry";
import { RunManager } from "@/runner/run-manager";
import type { PrerequisiteReport } from "@/types";

const readyReport = {
  ready: true,
  checkedAt: "2026-11-12T13:00:00.000Z",
  environment: "dev",
  apiLabel: "HML",
  appId: "com.example.app",
  simulatorUdid: "11111111-1111-4111-8111-111111111111",
  simulatorName: "iPhone 16 Plus",
  projectName: "Teste",
  driver: "flows",
  checks: [],
} satisfies PrerequisiteReport;

test("cadastra projeto com path absoluto e descobre fluxos sem executar", () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "maestro-reg-"));
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "maestro-app-"));
  fs.mkdirSync(path.join(repo, ".maestro/flows/pacientes"), { recursive: true });
  fs.writeFileSync(path.join(repo, ".maestro/flows/pacientes/listar.yaml"), "appId: com.clinica.app\n");
  const registry = new ProjectRegistry(dataDir);
  assert.throws(() => registry.createProject({ repositoryPath: "relativo" }), /diretório local absoluto/);
  const project = registry.createProject({
    name: "Clínica",
    type: "mobile",
    repositoryPath: repo,
  });
  assert.equal(project.name, "Clínica");
  const discovery = registry.discover(project.id);
  assert.equal(discovery.driver, "flows");
  assert.equal(discovery.appId, "com.clinica.app");
  assert.ok(discovery.suites.some((suite) => suite.id === "pacientes"));
  assert.ok(discovery.modules.some((module) => module.id === "pacientes"));
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.rmSync(repo, { recursive: true, force: true });
});

test("isola histórico entre projetos e recusa troca com execução ativa", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "maestro-iso-"));
  const first = path.join(dir, "one");
  const second = path.join(dir, "two");
  for (const repo of [first, second]) {
    fs.mkdirSync(path.join(repo, ".maestro/flows/login"), { recursive: true });
    fs.writeFileSync(path.join(repo, ".maestro/flows/login/sign_in.yaml"), "appId: com.example.app\n");
  }
  const registry = new ProjectRegistry(path.join(dir, "data"));
  const a = registry.createProject({ name: "Um", repositoryPath: first });
  const b = registry.createProject({ name: "Dois", repositoryPath: second });
  const manager = new RunManager({
    config: loadConfig({
      projectRoot: dir,
      dataDir: path.join(dir, "data"),
      repoRoot: first,
      maestroBin: "/usr/bin/true",
    }),
    registry,
    fixtureStepMs: 40,
    checkPrerequisites: async () => readyReport,
  });
  manager.selectProject(a.id);
  await manager.start({ suite: "smoke", mode: "fixture" });
  await manager.waitUntilIdle();
  assert.equal(manager.listRuns(10).length, 1);
  manager.selectProject(b.id);
  assert.equal(manager.listRuns(10).length, 0);
  const running = await manager.start({ suite: "smoke", mode: "fixture" });
  assert.equal(running.status, "running");
  assert.throws(() => manager.selectProject(a.id), /execução/);
  await manager.waitUntilIdle();
  manager.selectProject(a.id);
  assert.equal(manager.listRuns(10).every((run) => run.projectId === a.id), true);
  fs.rmSync(dir, { recursive: true, force: true });
});
