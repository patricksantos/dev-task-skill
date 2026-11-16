import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { plannedFlowsForSuite, type PlannedFlow } from "@/catalog/catalog";
import type { AppConfig } from "@/config";
import { RunStore } from "@/db/database";
import { EventHub } from "@/events/event-hub";
import { RequestError } from "@/errors";
import { JunitParseError, sanitizeJunitDocument, type ParsedJunit } from "@/junit/junit-report";
import { applyMaestroLine } from "@/parser/maestro-parser";
import { checkPrerequisites } from "@/prerequisites/prerequisites";
import { sanitizeText } from "@/sanitize/sanitize";
import { isSuiteId, resolveProject, type ProjectSuite } from "@/project";
import type { DashboardEvent, LogStream, LogView, RunMode, RunView, ScenarioView } from "@/types";
import { loadFixture } from "@/runner/fixtures";
import { createLineBuffer } from "@/runner/line-buffer";
import { countScenarios, reconcileScenarios, suiteStatus } from "@/runner/reconcile";

const BLOCKED_ENV = /(TOKEN|SECRET|PASSWORD|COOKIE|AUTHORIZATION|CREDENTIAL)/i;
const LOG_LIMIT = 8000;
const REPORT_NAME = /^reports\/[0-9a-f-]{36}\.xml$/i;

type SpawnImpl = (
  command: string,
  args: readonly string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    detached: boolean;
    stdio: ["ignore", "pipe", "pipe"];
  },
) => ChildProcess;

export interface RunManagerOptions {
  config: AppConfig;
  store?: RunStore;
  fixtureStepMs?: number;
  checkPrerequisites?: typeof checkPrerequisites;
  spawnImpl?: SpawnImpl;
}

interface ActiveRun {
  view: RunView;
  scenarios: ScenarioView[];
  pid: number | null;
  child: ChildProcess | null;
  stopRequested: boolean;
  settled: boolean;
  logCount: number;
}

function childEnvironment(config: AppConfig): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { NODE_ENV: process.env.NODE_ENV };
  for (const [key, value] of Object.entries(process.env)) {
    if (value == null || BLOCKED_ENV.test(key)) continue;
    env[key] = value;
  }
  env.CI = "1";
  env.NO_COLOR = "1";
  env.TERM = "dumb";
  env.MAESTRO_BIN = config.maestroBin;
  env.MAESTRO_UDID = config.simulatorUdid;
  return env;
}

function commandOf(pid: number): string | null {
  try {
    return execFileSync("/bin/ps", ["-p", String(pid), "-o", "command="], {
      encoding: "utf8",
      timeout: 1000,
    }).trim();
  } catch {
    return null;
  }
}

function blankScenario(flow: PlannedFlow, index: number): ScenarioView {
  return {
    name: flow.name,
    file: flow.file,
    module: flow.module,
    status: "pending",
    logSignal: "none",
    command: null,
    logError: null,
    errorMessage: null,
    startedAt: null,
    finishedAt: null,
    durationMs: null,
    confirmed: false,
    sortOrder: index,
  };
}

function shortenDevice(value: string | null | undefined): string | null {
  if (!value) return null;
  const name = value.split(" - ")[0]?.trim();
  return name || value;
}

function withoutPid(run: RunView & { pid?: number | null }): RunView {
  const { pid: _pid, ...view } = run;
  return view;
}

export class RunManager {
  readonly store: RunStore;
  readonly hub = new EventHub<DashboardEvent>();
  private active: ActiveRun | null = null;
  private orphan: { runId: string; pid: number } | null = null;
  private readonly idleWaiters: Array<() => void> = [];

  constructor(private readonly options: RunManagerOptions) {
    this.store = options.store ?? new RunStore(options.config.dataDir);
    this.recoverOrphans();
  }

  get busy(): boolean {
    return this.active !== null || this.orphan !== null;
  }

  snapshot(logLimit = 400): DashboardEvent {
    const current = this.currentRun();
    const scenarios = current
      ? this.active?.view.id === current.id
        ? this.active.scenarios
        : this.store.listScenarios(current.id)
      : [];
    return {
      type: "snapshot",
      run: current,
      scenarios,
      logs: current ? this.store.listLogs(current.id, logLimit) : [],
      serverTime: new Date().toISOString(),
    };
  }

  listRuns(limit = 30): RunView[] {
    return this.store.listRuns(limit);
  }

  details(id: string): { run: RunView; scenarios: ScenarioView[]; logs: LogView[] } | null {
    const run = this.publicRun(id);
    if (!run) return null;
    const scenarios = this.active?.view.id === id ? this.active.scenarios : this.store.listScenarios(id);
    return { run, scenarios, logs: this.store.listLogs(id, 1000) };
  }

  reportXml(id: string): string | null {
    const run = this.store.getRun(id);
    if (!run?.junitPath) return null;
    return this.readReport(run.junitPath);
  }

  private readReport(relative: string): string | null {
    if (!REPORT_NAME.test(relative)) return null;
    const absolute = path.resolve(this.options.config.dataDir, relative);
    const root = path.resolve(this.options.config.dataDir, "reports");
    if (!absolute.startsWith(`${root}${path.sep}`)) return null;
    try {
      return fs.readFileSync(absolute, "utf8");
    } catch {
      return null;
    }
  }

  async start(input: { suite?: string; mode?: string }): Promise<RunView> {
    if (!input.suite || !isSuiteId(input.suite)) throw new RequestError(400, "Suíte não permitida.");
    const mode = input.mode ?? "script";
    if (mode !== "script" && mode !== "fixture") throw new RequestError(400, "Modo não permitido.");
    if (this.active || this.orphan) {
      throw new RequestError(409, "Já existe uma suíte em execução neste simulador.");
    }
    const project = resolveProject(this.options.config.repoRoot);
    const suite = project.suites.find((item) => item.id === input.suite);
    if (mode === "script" && !suite) throw new RequestError(400, "Suíte não permitida.");
    if (mode === "script") {
      const report = await (this.options.checkPrerequisites ?? checkPrerequisites)(this.options.config);
      if (!report.ready) {
        throw new RequestError(412, "Pré-requisitos obrigatórios indisponíveis. Veja os alertas do dashboard.");
      }
    }

    const flows = plannedFlowsForSuite(this.options.config.repoRoot, input.suite);
    const now = new Date().toISOString();
    const view = this.createView(input.suite, suite?.label ?? input.suite, mode, flows.length, now);
    const active: ActiveRun = {
      view,
      scenarios: flows.map(blankScenario),
      pid: null,
      child: null,
      stopRequested: false,
      settled: false,
      logCount: 0,
    };
    this.active = active;
    this.store.insertRun(view, null);
    this.store.saveScenarios(view.id, active.scenarios);
    this.publishState();

    if (mode === "fixture") void this.playFixture(active);
    else if (suite?.kind === "maestro") this.spawnMaestro(active, suite);
    else this.spawnScript(active, suite);

    return this.publicRun(view.id) ?? view;
  }

  stop(id: string): void {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new RequestError(400, "Identificador inválido.");
    if (this.active?.view.id === id) {
      this.active.stopRequested = true;
      if (this.active.child) this.killPid(this.active.child.pid);
      return;
    }
    if (this.orphan?.runId === id) {
      this.killPid(this.orphan.pid);
      this.finishOrphan();
      return;
    }
    if (!this.store.getRun(id)) throw new RequestError(404, "Execução não encontrada.");
    throw new RequestError(409, "Esta execução não está em andamento.");
  }

  waitUntilIdle(timeoutMs = 5000): Promise<void> {
    if (!this.active && !this.orphan) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("tempo esgotado aguardando a execução")), timeoutMs);
      this.idleWaiters.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  private createView(suite: string, label: string, mode: RunMode, total: number, now: string): RunView {
    return {
      id: randomUUID(),
      createdAt: now,
      startedAt: now,
      finishedAt: null,
      environment: this.options.config.environmentLabel,
      apiLabel: this.options.config.apiLabel,
      appId: this.options.config.appId,
      simulatorUdid: this.options.config.simulatorUdid,
      simulatorName: null,
      suite,
      suiteLabel: label,
      mode,
      status: "running",
      durationMs: null,
      passedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      abortedCount: 0,
      runningCount: 0,
      pendingCount: total,
      totalCount: total,
      exitCode: null,
      junitPath: null,
      errorMessage: null,
    };
  }

  private spawnMaestro(active: ActiveRun, suite: ProjectSuite): void {
    const target = suite.target ? path.resolve(this.options.config.repoRoot, suite.target) : "";
    const flowsRoot = path.resolve(this.options.config.repoRoot, ".maestro", "flows");
    const report = path.resolve(this.options.config.repoRoot, suite.report);
    const reportsDir = path.resolve(this.options.config.repoRoot, ".maestro", "reports");
    const insideFlows = target === flowsRoot || target.startsWith(`${flowsRoot}${path.sep}`);
    if (!insideFlows || !report.startsWith(`${reportsDir}${path.sep}`)) {
      this.finish(active, null, false, "Fluxo fora da pasta .maestro.");
      return;
    }
    fs.mkdirSync(reportsDir, { recursive: true });
    let child: ChildProcess;
    try {
      child = (this.options.spawnImpl ?? spawn)(this.options.config.maestroBin, ["test", "--format", "JUNIT", "--output", report, target], {
        cwd: this.options.config.repoRoot,
        env: childEnvironment(this.options.config),
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      this.finish(active, null, false, sanitizeText(error instanceof Error ? error.message : "Falha ao iniciar o Maestro."));
      return;
    }
    this.attachChild(active, child);
  }

  private spawnScript(active: ActiveRun, suite: ProjectSuite | undefined): void {
    if (!suite?.script) {
      this.finish(active, null, false, "Script fora da lista autorizada.");
      return;
    }
    const scriptPath = path.resolve(this.options.config.repoRoot, suite.script);
    const scriptsDir = path.resolve(this.options.config.repoRoot, "scripts");
    if (
      !scriptPath.startsWith(`${scriptsDir}${path.sep}`) ||
      path.basename(scriptPath) !== path.basename(suite.script) ||
      !/^[A-Za-z0-9._/-]+$/.test(scriptPath)
    ) {
      this.finish(active, null, false, "Script fora da lista autorizada.");
      return;
    }

    let child: ChildProcess;
    try {
      child = (this.options.spawnImpl ?? spawn)(scriptPath, [], {
        cwd: this.options.config.repoRoot,
        env: childEnvironment(this.options.config),
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      this.finish(active, null, false, sanitizeText(error instanceof Error ? error.message : "Falha ao iniciar o script."));
      return;
    }

    this.attachChild(active, child);
  }

  private attachChild(active: ActiveRun, child: ChildProcess): void {
    active.child = child;
    active.pid = child.pid ?? null;
    this.store.updateRun(active.view, active.pid);
    const stdout = createLineBuffer((line) => this.ingest(active, "stdout", line));
    const stderr = createLineBuffer((line) => this.ingest(active, "stderr", line));
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => stdout.push(chunk));
    child.stderr?.on("data", (chunk: string) => stderr.push(chunk));
    child.on("error", (error) => {
      stdout.flush();
      stderr.flush();
      this.finish(active, null, active.stopRequested, sanitizeText(error.message));
    });
    child.on("close", (code, signal) => {
      stdout.flush();
      stderr.flush();
      this.finish(active, code, active.stopRequested || signal != null, active.stopRequested ? "Execução interrompida." : null);
    });
  }

  private async playFixture(active: ActiveRun): Promise<void> {
    try {
      const fixture = loadFixture(
        active.view.suite,
        active.scenarios.map((scenario) => ({
          name: scenario.name,
          file: scenario.file ?? "",
          module: scenario.module ?? "",
        })),
      );
      if (fixture.empty) {
        active.scenarios = [];
        Object.assign(active.view, countScenarios([]));
        this.store.saveScenarios(active.view.id, []);
        if (fixture.junit.trim()) active.view.junitPath = this.storeSanitizedReport(active.view.id, fixture.junit);
        this.finish(active, fixture.exitCode, false, fixture.failureMessage ?? null);
        return;
      }
      const step = this.options.fixtureStepMs ?? 40;
      for (const line of fixture.lines) {
        if (active.stopRequested) break;
        this.ingest(active, "stdout", line);
        if (step > 0) await new Promise((resolve) => setTimeout(resolve, step));
      }
      if (active.stopRequested) {
        this.finish(active, null, true, "Execução interrompida.");
        return;
      }
      if (fixture.junit.trim()) active.view.junitPath = this.storeSanitizedReport(active.view.id, fixture.junit);
      this.finish(active, fixture.exitCode, false, fixture.failureMessage ?? null);
    } catch (error) {
      this.finish(active, 1, false, sanitizeText(error instanceof Error ? error.message : "Falha ao reproduzir a fixture."));
    }
  }

  private ingest(active: ActiveRun, stream: LogStream, rawLine: string): void {
    if (active.settled) return;
    const line = sanitizeText(rawLine);
    if (!line.trim()) return;
    if (active.logCount >= LOG_LIMIT) return;
    active.logCount += 1;
    const now = new Date().toISOString();
    const effect = applyMaestroLine(line, active.scenarios, now);
    const stored = this.store.insertLog({
      runId: active.view.id,
      scenarioName: effect.scenarioName,
      stream,
      ts: now,
      line,
      command: effect.command,
    });
    this.hub.publish({
      type: "log",
      run: withoutPid(active.view),
      log: stored,
      serverTime: now,
    });
    if (effect.deviceName) active.view.simulatorName = shortenDevice(effect.deviceName);
    if (effect.changed || effect.deviceName) {
      Object.assign(active.view, countScenarios(active.scenarios));
      this.store.updateRun(active.view, active.pid);
      this.store.saveScenarios(active.view.id, active.scenarios);
      this.publishState();
    }
  }

  private finish(active: ActiveRun, exitCode: number | null, aborted: boolean, fallbackError: string | null): void {
    if (active.settled) return;
    active.settled = true;
    const finishedAt = new Date().toISOString();
    let junit: ParsedJunit | null = null;
    let reportError: string | null = null;

    if (active.view.mode === "script") {
      const copied = this.copyScriptReport(active);
      active.view.junitPath = copied.path;
      junit = copied.report;
      reportError = copied.error;
    } else if (active.view.junitPath) {
      const xml = this.readReport(active.view.junitPath);
      if (xml) {
        try {
          junit = sanitizeJunitDocument(xml).report;
        } catch (error) {
          reportError = error instanceof JunitParseError ? error.message : "Falha ao ler o JUnit.";
        }
      }
    }

    active.scenarios = reconcileScenarios(active.scenarios, junit, { exitCode, aborted, finishedAt });
    const status = suiteStatus(active.scenarios, { exitCode, aborted, finishedAt }, junit);
    const failedCount = active.scenarios.filter((scenario) => scenario.status === "failed").length;
    let errorMessage = fallbackError;
    if (aborted) errorMessage = "Execução interrompida.";
    else if (reportError) errorMessage = reportError;
    else if (!junit && exitCode === 0) errorMessage = "JUnit ausente; resultado confirmado apenas pelo código de saída 0.";
    else if (exitCode && exitCode !== 0 && failedCount === 0) errorMessage = fallbackError ?? `O processo encerrou com código ${exitCode}.`;
    else if (failedCount === 1) errorMessage = "1 cenário reprovado.";
    else if (failedCount > 1) errorMessage = `${failedCount} cenários reprovados.`;

    const started = Date.parse(active.view.startedAt ?? active.view.createdAt);
    Object.assign(active.view, countScenarios(active.scenarios), {
      status,
      finishedAt,
      durationMs: Number.isNaN(started) ? null : Date.parse(finishedAt) - started,
      exitCode,
      simulatorName: shortenDevice(junit?.device) ?? active.view.simulatorName,
      errorMessage,
    });
    this.store.updateRun(active.view, null);
    this.store.saveScenarios(active.view.id, active.scenarios);
    this.publishState();
    if (this.active?.view.id === active.view.id) this.active = null;
    this.resolveIdle();
  }

  private copyScriptReport(active: ActiveRun): { path: string | null; report: ParsedJunit | null; error: string | null } {
    const suite = resolveProject(this.options.config.repoRoot).suites.find((item) => item.id === active.view.suite);
    const source = path.resolve(this.options.config.repoRoot, suite?.report ?? "");
    const reportsDir = path.resolve(this.options.config.repoRoot, ".maestro", "reports");
    if (!source.startsWith(`${reportsDir}${path.sep}`)) {
      return { path: null, report: null, error: "Caminho de relatório fora da pasta esperada." };
    }
    let modified = 0;
    try {
      modified = fs.statSync(source).mtimeMs;
    } catch {
      return { path: null, report: null, error: null };
    }
    const started = Date.parse(active.view.startedAt ?? active.view.createdAt);
    if (modified + 1000 < started) return { path: null, report: null, error: null };
    try {
      const sanitized = sanitizeJunitDocument(fs.readFileSync(source, "utf8"));
      return { path: this.writeReport(active.view.id, sanitized.xml), report: sanitized.report, error: null };
    } catch (error) {
      return {
        path: null,
        report: null,
        error: error instanceof JunitParseError ? error.message : "Não foi possível ler o relatório JUnit.",
      };
    }
  }

  private storeSanitizedReport(id: string, xml: string): string {
    return this.writeReport(id, sanitizeJunitDocument(xml).xml);
  }

  private writeReport(id: string, xml: string): string {
    const directory = path.join(this.options.config.dataDir, "reports");
    fs.mkdirSync(directory, { recursive: true });
    const relative = `reports/${id}.xml`;
    fs.writeFileSync(path.join(this.options.config.dataDir, relative), xml);
    return relative;
  }

  private publishState(): void {
    if (!this.active) return;
    this.hub.publish({
      type: "state",
      run: withoutPid(this.active.view),
      scenarios: this.active.scenarios.map((scenario) => ({ ...scenario })),
      serverTime: new Date().toISOString(),
    });
  }

  private currentRun(): RunView | null {
    if (this.active) return withoutPid(this.active.view);
    if (this.orphan) return this.publicRun(this.orphan.runId);
    const latest = this.store.latestRun();
    return latest ? withoutPid(latest) : null;
  }

  private publicRun(id: string): RunView | null {
    const run = this.store.getRun(id);
    return run ? withoutPid(run) : null;
  }

  private killPid(pid: number | undefined): void {
    if (!pid) return;
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        return;
      }
    }
    const timer = setTimeout(() => {
      try {
        process.kill(-pid, "SIGKILL");
      } catch {
        try {
          process.kill(pid, "SIGKILL");
        } catch {
          /* already exited */
        }
      }
    }, 2000);
    timer.unref();
  }

  private recoverOrphans(): void {
    for (const run of this.store.listRunning()) {
      if (!run.pid) {
        this.markInterrupted(run.id);
        continue;
      }
      const command = commandOf(run.pid);
      const owned = command != null && command.includes(this.options.config.repoRoot) && (command.includes("run_maestro_") || command.includes(this.options.config.maestroBin));
      if (owned) {
        this.orphan = { runId: run.id, pid: run.pid };
        continue;
      }
      this.markInterrupted(run.id);
    }
  }

  private finishOrphan(): void {
    if (!this.orphan) return;
    this.markInterrupted(this.orphan.runId);
    this.orphan = null;
    this.hub.publish(this.snapshot());
    this.resolveIdle();
  }

  private markInterrupted(id: string): void {
    const run = this.store.getRun(id);
    if (!run || run.status !== "running") return;
    const finishedAt = new Date().toISOString();
    const scenarios = reconcileScenarios(this.store.listScenarios(id), null, {
      exitCode: null,
      aborted: true,
      finishedAt,
    });
    const started = Date.parse(run.startedAt ?? run.createdAt);
    this.store.updateRun(
      {
        ...withoutPid(run),
        ...countScenarios(scenarios),
        status: "aborted",
        finishedAt,
        durationMs: Number.isNaN(started) ? null : Date.parse(finishedAt) - started,
        errorMessage: "Execução interrompida.",
      },
      null,
    );
    this.store.saveScenarios(id, scenarios);
  }

  private resolveIdle(): void {
    for (const waiter of this.idleWaiters) waiter();
    this.idleWaiters.length = 0;
  }
}
