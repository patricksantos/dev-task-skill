import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadConfig } from "@/config";
import { RequestError } from "@/errors";
import type { PrerequisiteReport } from "@/types";
import { RunManager } from "@/runner/run-manager";

const readyReport = {
  ready: true,
  checkedAt: "2026-11-12T13:00:00.000Z",
  environment: "dev",
  apiLabel: "HML",
  appId: "com.example.app",
  simulatorUdid: "11111111-1111-4111-8111-111111111111",
  simulatorName: "iPhone 16 Plus",
  projectName: "Teste",
  driver: "scripts",
  checks: [],
} satisfies PrerequisiteReport;

function managerFor(dir: string, fixtureStepMs = 0): RunManager {
  return new RunManager({
    config: loadConfig({
      projectRoot: dir,
      dataDir: path.join(dir, "data"),
      repoRoot: path.join(dir, "repo"),
      maestroBin: "/usr/bin/true",
    }),
    fixtureStepMs,
    checkPrerequisites: async () => readyReport,
  });
}

test("fixture percorre o runner real e preserva relatórios distintos", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "maestro-runner-"));
  const manager = managerFor(dir);
  const first = await manager.start({ suite: "smoke", mode: "fixture" });
  await manager.waitUntilIdle();
  const second = await manager.start({ suite: "smoke", mode: "fixture" });
  await manager.waitUntilIdle();

  const stored = manager.details(first.id);
  assert.equal(stored?.run.status, "failed");
  assert.equal(stored?.run.passedCount, 3);
  assert.equal(stored?.run.failedCount, 1);
  assert.equal(stored?.scenarios.find((scenario) => scenario.name === "home_to_stores")?.status, "passed");
  assert.equal(stored?.scenarios.find((scenario) => scenario.name === "home_to_stores")?.logSignal, "passed");
  assert.equal(stored?.scenarios.find((scenario) => scenario.name === "home_to_coupons")?.status, "failed");
  assert.equal(stored?.scenarios.find((scenario) => scenario.name === "home_to_coupons")?.logSignal, "failed");
  const failedLogs = stored?.logs.filter((entry) => entry.line.includes("FAILED")) ?? [];
  assert.equal(failedLogs.length, 1);
  assert.equal(failedLogs[0]?.scenarioName, "home_to_coupons");
  assert.equal(failedLogs[0]?.runId, first.id);
  assert.equal(stored?.logs.every((entry) => entry.runId === first.id), true);
  assert.equal(stored?.run.junitPath?.endsWith(`${first.id}.xml`), true);
  assert.notEqual(first.junitPath, second.junitPath);

  const logs = stored?.logs.map((entry) => entry.line).join("\n") ?? "";
  assert.equal(logs.includes("eyJ"), false);
  assert.equal(logs.includes("signaturevaluehere"), false);
  const report = manager.reportXml(first.id) ?? "";
  assert.equal(report.includes("user@example.com"), false);
  const firstXml = fs.readFileSync(path.join(dir, "data", stored?.run.junitPath ?? ""), "utf8");
  await manager.start({ suite: "stores", mode: "fixture" });
  await manager.waitUntilIdle();
  assert.equal(fs.readFileSync(path.join(dir, "data", stored?.run.junitPath ?? ""), "utf8"), firstXml);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("recusa suíte fora da lista e execução simultânea", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "maestro-lock-"));
  const repo = path.join(dir, "repo");
  fs.mkdirSync(path.join(repo, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(repo, ".maestro/reports"), { recursive: true });
  fs.writeFileSync(
    path.join(repo, "scripts/run_maestro_smoke.sh"),
    "#!/bin/bash\n# .maestro/flows/smoke/home.yaml\necho starting\nsleep 30\n",
    { mode: 0o755 },
  );
  const manager = managerFor(dir);
  await assert.rejects(
    () => manager.start({ suite: "rm -rf /", mode: "script" }),
    (error: unknown) => error instanceof RequestError && error.status === 400,
  );
  const run = await manager.start({ suite: "smoke", mode: "script" });
  await assert.rejects(
    () => manager.start({ suite: "stores", mode: "script" }),
    (error: unknown) => error instanceof RequestError && error.status === 409,
  );
  manager.stop(run.id);
  await manager.waitUntilIdle(4000);
  assert.equal(manager.details(run.id)?.run.status, "aborted");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("script simulado grava JUnit próprio e não trata o log como resultado final", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "maestro-script-"));
  const repo = path.join(dir, "repo");
  fs.mkdirSync(path.join(repo, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(repo, ".maestro/reports"), { recursive: true });
  fs.writeFileSync(
    path.join(repo, "scripts/run_maestro_smoke.sh"),
    `#!/bin/bash
# .maestro/flows/smoke/home.yaml
echo 'Running on iPhone 16 Plus - iOS 18.5 - 11111111-1111-4111-8111-111111111111'
echo ' > Flow home'
echo 'Launch app "com.example.app"... FAILED'
echo 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyIn0.signaturevaluehere' >&2
cat > .maestro/reports/suite.xml << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="Test Suite" device="iPhone 16 Plus" tests="1" failures="0" time="1">
    <testcase name="home" file=".maestro/flows/smoke/home.yaml" time="1.0" status="SUCCESS"/>
  </testsuite>
</testsuites>
EOF
exit 0
`,
    { mode: 0o755 },
  );
  const manager = managerFor(dir);
  const run = await manager.start({ suite: "smoke", mode: "script" });
  await manager.waitUntilIdle(4000);
  const stored = manager.details(run.id);
  assert.equal(stored?.run.status, "passed");
  assert.equal(stored?.scenarios[0]?.status, "passed");
  assert.equal(stored?.scenarios[0]?.logSignal, "failed");
  const stderr = stored?.logs.filter((entry) => entry.stream === "stderr").map((entry) => entry.line).join("\n") ?? "";
  assert.equal(stderr.includes("eyJ"), false);
  assert.match(stderr, /\[redacted/);
  assert.equal(manager.reportXml(run.id)?.includes("status=\"SUCCESS\""), true);
  assert.equal(stored?.logs.find((entry) => entry.line.includes("FAILED"))?.scenarioName, "home");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("demonstrações coerentes cobrem sucesso, infraestrutura, suíte vazia e interrupção", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "maestro-demos-"));
  const manager = managerFor(dir);

  const passed = await manager.start({ suite: "stores", mode: "fixture" });
  await manager.waitUntilIdle();
  const passedDetails = manager.details(passed.id);
  assert.equal(passedDetails?.run.mode, "fixture");
  assert.equal(passedDetails?.run.status, "passed");
  assert.equal(passedDetails?.run.failedCount, 0);
  assert.equal(passedDetails?.scenarios.every((scenario) => scenario.status === "passed" && scenario.logSignal === "passed" && scenario.confirmed), true);

  const infra = await manager.start({ suite: "coupons", mode: "fixture" });
  await manager.waitUntilIdle();
  const infraDetails = manager.details(infra.id);
  assert.equal(infraDetails?.run.status, "failed");
  assert.equal(infraDetails?.run.failedCount, 0);
  assert.match(infraDetails?.run.errorMessage ?? "", /infraestrutura/);
  assert.equal(infraDetails?.scenarios.every((scenario) => scenario.status === "skipped"), true);
  assert.equal(infraDetails?.logs.some((entry) => entry.scenarioName != null), false);
  assert.equal(infraDetails?.run.junitPath, null);

  const empty = await manager.start({ suite: "navigation", mode: "fixture" });
  await manager.waitUntilIdle();
  const emptyDetails = manager.details(empty.id);
  assert.equal(emptyDetails?.run.status, "passed");
  assert.equal(emptyDetails?.run.totalCount, 0);
  assert.equal(emptyDetails?.scenarios.length, 0);
  assert.match(manager.reportXml(empty.id) ?? "", /tests="0"/);

  const history = manager.listRuns(10);
  const ids = history.map((run) => run.id);
  assert.equal(ids.includes(passed.id), true);
  assert.equal(ids.includes(infra.id), true);
  assert.equal(ids.includes(empty.id), true);
  assert.equal(manager.details(passed.id)?.logs.every((entry) => entry.runId === passed.id), true);
  assert.equal(manager.details(infra.id)?.logs.every((entry) => entry.runId === infra.id), true);

  fs.rmSync(dir, { recursive: true, force: true });
});

test("interromper a demonstração não mistura o resultado com outra execução", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "maestro-abort-"));
  const manager = managerFor(dir, 30);
  const run = await manager.start({ suite: "smoke", mode: "fixture" });
  assert.equal(run.status, "running");
  manager.stop(run.id);
  await manager.waitUntilIdle(4000);
  const stored = manager.details(run.id);
  assert.equal(stored?.run.status, "aborted");
  assert.equal(stored?.run.errorMessage, "Execução interrompida.");
  assert.equal(stored?.scenarios.every((scenario) => scenario.status === "aborted"), true);
  assert.equal(stored?.logs.every((entry) => entry.runId === run.id), true);
  const next = await manager.start({ suite: "stores", mode: "fixture" });
  await manager.waitUntilIdle();
  assert.notEqual(next.id, run.id);
  assert.equal(manager.details(next.id)?.logs.every((entry) => entry.runId === next.id), true);
  assert.equal(manager.details(run.id)?.run.status, "aborted");
  fs.rmSync(dir, { recursive: true, force: true });
});
