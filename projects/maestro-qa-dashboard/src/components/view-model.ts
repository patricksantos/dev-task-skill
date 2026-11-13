import type { CatalogFlow, DashboardEvent, LogStream, LogView, PrerequisiteCheck, PrerequisiteReport, RunStatus, RunView, ScenarioStatus, ScenarioView } from "@/types";
import { formatPercent } from "@/components/format";

const FINISHED: ScenarioStatus[] = ["passed", "failed", "skipped", "aborted"];

const MODULE_LABELS: Record<string, string> = {
  smoke: "Smoke",
  stores: "Lojas",
  coupons: "Cupons",
  navigation: "Navegação",
};

export type FlowAvailability = "included" | "available" | "blocked";
export type HistoryFilter = "all" | "real" | "demo";

export function moduleLabel(moduleName: string | null): string {
  if (!moduleName) return "—";
  return MODULE_LABELS[moduleName] ?? moduleName;
}

export function executionProgress(scenarios: ScenarioView[]) {
  const total = scenarios.length;
  const confirmed = scenarios.filter(
    (scenario) => scenario.confirmed || FINISHED.includes(scenario.status),
  ).length;
  const current = [...scenarios].reverse().find((scenario) => scenario.status === "running") ?? null;
  return {
    total,
    confirmed,
    ratio: total === 0 ? 0 : confirmed / total,
    currentName: current?.name ?? null,
    currentCommand: current?.command ?? null,
  };
}

export function scenarioDuration(scenario: ScenarioView, now: number): number | null {
  if (scenario.durationMs != null) return scenario.durationMs;
  if (scenario.status !== "running" || !scenario.startedAt) return null;
  const started = Date.parse(scenario.startedAt);
  if (Number.isNaN(started)) return null;
  return Math.max(0, now - started);
}

export function filterScenarios(scenarios: ScenarioView[], moduleName: string, status: string): ScenarioView[] {
  return scenarios.filter((scenario) => {
    const moduleMatches = moduleName === "all" || scenario.module === moduleName;
    const statusMatches = status === "all" || scenario.status === status;
    return moduleMatches && statusMatches;
  });
}

export function isFailureLine(line: string, stream: LogStream): boolean {
  return stream === "stderr" || /\b(FAILED|Assertion is false|Element not found|Unable to|Command failed)\b/i.test(line);
}

export function filterLogs(
  logs: LogView[],
  options: { stream: LogStream | "all"; query: string; scenario: string | null },
): LogView[] {
  const needle = options.query.trim().toLowerCase();
  return logs.filter((entry) => {
    if (options.stream !== "all" && entry.stream !== options.stream) return false;
    if (options.scenario && entry.scenarioName !== options.scenario) return false;
    if (!needle) return true;
    const haystack = `${entry.line} ${entry.scenarioName ?? ""}`.toLowerCase();
    return haystack.includes(needle);
  });
}

const COMMAND_DONE =
  /^\s*(?:[✅❌⚠️]\s*)?(.+?)\s*\.\.\.\s*(COMPLETED|FAILED|WARNED|SKIPPED|PENDING)\s*$/iu;
const BOX_MARK = /^\s*║\s*([✅❌⚠️])\s+(.+?)\s*$/u;

export interface CommandStep {
  text: string;
  signal: "passed" | "failed" | "skipped" | "running";
  at: string;
}

function commandSignal(outcome: string): CommandStep["signal"] {
  const value = outcome.toUpperCase();
  if (value === "COMPLETED" || value === "PASSED") return "passed";
  if (value === "FAILED") return "failed";
  if (value === "SKIPPED" || value === "WARNED") return "skipped";
  return "running";
}

function markSignal(mark: string): CommandStep["signal"] {
  if (mark === "✅") return "passed";
  if (mark === "❌") return "failed";
  return "skipped";
}

export function commandSteps(logs: LogView[], scenarioName: string): CommandStep[] {
  const steps: CommandStep[] = [];
  for (const entry of logs) {
    if (entry.scenarioName !== scenarioName) continue;
    const done = entry.line.trim().match(COMMAND_DONE);
    if (done?.[1] && done[2]) {
      steps.push({ text: done[1].trim(), signal: commandSignal(done[2]), at: entry.ts });
      continue;
    }
    const boxed = entry.line.match(BOX_MARK);
    if (boxed?.[1] && boxed[2] && !/^>\s*Flow\b/i.test(boxed[2])) {
      steps.push({ text: boxed[2].trim(), signal: markSignal(boxed[1]), at: entry.ts });
      continue;
    }
    if (entry.command) {
      steps.push({ text: entry.command, signal: "running", at: entry.ts });
    }
  }
  return steps;
}

export function scenarioKey(runId: string, scenario: Pick<ScenarioView, "sortOrder" | "file" | "name">): string {
  return `${runId}:${scenario.sortOrder}:${scenario.file ?? scenario.name}`;
}

export function isLiveScenario(scenarios: ScenarioView[], scenario: ScenarioView): boolean {
  if (scenario.confirmed || scenario.status !== "running") return false;
  const live = [...scenarios].reverse().find((item) => item.status === "running" && !item.confirmed);
  if (!live) return false;
  return live.sortOrder === scenario.sortOrder && live.name === scenario.name && live.file === scenario.file;
}

export function showProvisionalBadge(scenario: ScenarioView, live: boolean): boolean {
  if (scenario.confirmed || live || scenario.status !== "running") return false;
  return scenario.logSignal === "passed" || scenario.logSignal === "failed" || scenario.logSignal === "skipped";
}

export function rowResult(scenario: ScenarioView): string {
  if (!scenario.confirmed) {
    if (scenario.logSignal === "failed") {
      return scenario.logError ? `Provisório: ${scenario.logError}` : "Sinal provisório de reprovação";
    }
    if (scenario.logSignal === "passed") return "Sinal provisório de aprovação";
    if (scenario.logSignal === "skipped") return "Sinal provisório";
    return "Aguardando confirmação";
  }
  return scenario.errorMessage ?? "Sem falha";
}

export function detailFailure(scenario: ScenarioView): string {
  if (!scenario.confirmed) {
    if (scenario.logSignal === "failed") {
      return scenario.logError ?? "Sinal provisório de reprovação. O JUnit ainda não confirmou.";
    }
    if (scenario.logSignal === "passed") return "Sinal provisório de aprovação. O JUnit ainda não confirmou.";
    if (scenario.logSignal === "skipped") return "Sinal provisório. O JUnit ainda não confirmou.";
    return "Aguardando confirmação do processo ou do JUnit.";
  }
  return scenario.errorMessage ?? "Sem falha confirmada.";
}

export function confirmationNote(scenario: ScenarioView): string | null {
  if (!scenario.confirmed) return null;
  const fromLog =
    scenario.logSignal === "failed" ? "failed" : scenario.logSignal === "passed" ? "passed" : scenario.logSignal === "skipped" ? "skipped" : null;
  if (fromLog && fromLog !== scenario.status && scenario.status !== "aborted") {
    return "O sinal do log divergiu do JUnit. O resultado exibido é o do relatório.";
  }
  return null;
}

export interface LiveBoard {
  run: RunView | null;
  scenarios: ScenarioView[];
  logs: LogView[];
}

export function foldLiveEvent(board: LiveBoard, event: DashboardEvent): LiveBoard {
  if (event.type === "log") {
    if (!event.log || !board.run || event.log.runId !== board.run.id) return board;
    return {
      ...board,
      logs: [...board.logs.filter((item) => item.runId === board.run?.id), event.log].slice(-800),
    };
  }
  const run = event.run;
  const scenarios = event.scenarios ?? [];
  if (event.type === "snapshot") {
    return {
      run,
      scenarios,
      logs: run ? (event.logs ?? []).filter((item) => item.runId === run.id) : [],
    };
  }
  return {
    run,
    scenarios,
    logs: board.logs.filter((item) => run != null && item.runId === run.id),
  };
}

export const SUCCESS_NOTE =
  "A taxa divide aprovados por aprovados + reprovados. Ignorados, interrompidos, pendentes e em execução entram no total e ficam fora da taxa.";

export interface BoardIndicators {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  aborted: number;
  pending: number;
  running: number;
  success: string;
}

export function boardIndicators(run: RunView | null, scenarios: ScenarioView[]): BoardIndicators {
  const passed = scenarios.filter((scenario) => scenario.status === "passed").length;
  const failed = scenarios.filter((scenario) => scenario.status === "failed").length;
  const skipped = scenarios.filter((scenario) => scenario.status === "skipped").length;
  const aborted = scenarios.filter((scenario) => scenario.status === "aborted").length;
  const pending = scenarios.filter((scenario) => scenario.status === "pending").length;
  const running = scenarios.filter((scenario) => scenario.status === "running").length;
  return {
    total: passed + failed + skipped + aborted + pending + running,
    passed,
    failed,
    skipped,
    aborted,
    pending,
    running,
    success: successLabel(run?.status ?? null, scenarios),
  };
}

export function successLabel(status: RunStatus | null, scenarios: ScenarioView[]): string {
  if (!status || status === "running" || status === "aborted") return "—";
  const passed = scenarios.filter((scenario) => scenario.status === "passed").length;
  const failed = scenarios.filter((scenario) => scenario.status === "failed").length;
  if (passed + failed === 0) return "—";
  return formatPercent(passed, passed + failed);
}

export function classifyFlow(
  flow: Pick<CatalogFlow, "name" | "module" | "suites">,
  checks: PrerequisiteCheck[] | null,
  gateStores = true,
): { availability: FlowAvailability; reason: string } {
  if (!flow.suites.includes("all")) {
    return { availability: "available", reason: "Disponível, mas não incluído na suíte completa." };
  }
  const requiredDown = (checks ?? []).filter((check) => check.level === "required" && !check.ok);
  if (requiredDown.length > 0) {
    return { availability: "blocked", reason: "Bloqueado por pré-requisito obrigatório." };
  }
  const hml = checks?.find((check) => check.id === "hml");
  const needsHml = gateStores && (flow.module === "stores" || flow.name === "home_to_stores");
  if (needsHml && hml && !hml.ok) {
    return { availability: "blocked", reason: "Bloqueado: a API de homologação não respondeu." };
  }
  return { availability: "included", reason: "Incluído na suíte completa." };
}

export function prereqSummary(report: PrerequisiteReport | null): { label: string; tone: "ok" | "warn" | "bad" | "loading" } {
  if (!report) return { label: "Verificando", tone: "loading" };
  if (!report.ready) return { label: "Bloqueado", tone: "bad" };
  if (report.checks.some((check) => check.level === "warning" && !check.ok)) return { label: "Atenção", tone: "warn" };
  return { label: "Prontos", tone: "ok" };
}

export function runnerLabel(run: RunView | null, pending: boolean): { label: string; tone: "idle" | "live" | "demo" } {
  if (run?.status === "running" && run.mode === "fixture") return { label: "Demonstração", tone: "demo" };
  if (run?.status === "running") return { label: `Executando ${run.suiteLabel}`, tone: "live" };
  if (pending) return { label: "Iniciando", tone: "live" };
  return { label: "Pronto", tone: "idle" };
}

export function filterHistory(runs: RunView[], filter: HistoryFilter): RunView[] {
  if (filter === "real") return runs.filter((run) => run.mode === "script");
  if (filter === "demo") return runs.filter((run) => run.mode === "fixture");
  return runs;
}

const MAESTRO_COMMANDS: Array<[RegExp, string]> = [
  [/^Launch app\b/i, "launchApp"],
  [/^Tap on\b/i, "tapOn"],
  [/^Double tap\b/i, "doubleTapOn"],
  [/^Long press\b/i, "longPressOn"],
  [/^Assert not\b/i, "assertNotVisible"],
  [/^Assert that\b/i, "assertVisible"],
  [/^Input text\b/i, "inputText"],
  [/^Erase text\b/i, "eraseText"],
  [/^Extended wait\b/i, "extendedWaitUntil"],
  [/^Run flow\b/i, "runFlow"],
  [/^Swipe\b/i, "swipe"],
  [/^Scroll\b/i, "scroll"],
  [/^Press\b/i, "pressKey"],
  [/^Hide keyboard\b/i, "hideKeyboard"],
  [/^Wait\b/i, "waitForAnimationToEnd"],
  [/^Repeat\b/i, "repeat"],
  [/^Retry\b/i, "retry"],
];

export function maestroCommandName(text: string): string | null {
  return MAESTRO_COMMANDS.find(([pattern]) => pattern.test(text.trim()))?.[1] ?? null;
}

export interface TimelineStep {
  key: string;
  order: number;
  scenarioName: string;
  text: string;
  command: string | null;
  signal: CommandStep["signal"];
  at: string;
  durationMs: number | null;
  error: string | null;
}

export function executionTimeline(scenarios: ScenarioView[], logs: LogView[], runId: string): TimelineStep[] {
  const scoped = logs.filter((entry) => entry.runId === runId);
  const steps: TimelineStep[] = [];
  for (const scenario of scenarios) {
    const commands = commandSteps(scoped, scenario.name);
    commands.forEach((step, index) => {
      const current = Date.parse(step.at);
      const next = Date.parse(commands[index + 1]?.at ?? "");
      const durationMs = !Number.isNaN(current) && !Number.isNaN(next) ? Math.max(0, next - current) : null;
      steps.push({
        key: `${scenario.sortOrder}:${scenario.name}:${index}`,
        order: steps.length + 1,
        scenarioName: scenario.name,
        text: step.text,
        command: maestroCommandName(step.text),
        signal: step.signal,
        at: step.at,
        durationMs,
        error: step.signal === "failed" ? scenario.errorMessage ?? scenario.logError : null,
      });
    });
  }
  return steps;
}

export interface HistorySummary {
  basis: "real" | "empty";
  runs: number;
  tests: number;
  passed: number;
  failed: number;
  skipped: number;
  aborted: number;
  running: number;
  pending: number;
  success: string;
  successNote: string;
  averageMs: number | null;
  latest: RunView[];
  last: RunView | null;
}

export function historySummary(runs: RunView[]): HistorySummary {
  const real = runs.filter((item) => item.mode === "script" && item.status !== "running");
  const passed = real.reduce((sum, item) => sum + item.passedCount, 0);
  const failed = real.reduce((sum, item) => sum + item.failedCount, 0);
  const skipped = real.reduce((sum, item) => sum + item.skippedCount, 0);
  const aborted = real.reduce((sum, item) => sum + item.abortedCount, 0);
  const running = real.reduce((sum, item) => sum + item.runningCount, 0);
  const pending = real.reduce((sum, item) => sum + item.pendingCount, 0);
  const durations = real.map((item) => item.durationMs).filter((value): value is number => value != null);
  const judged = passed + failed;
  return {
    basis: real.length ? "real" : "empty",
    runs: real.length,
    tests: passed + failed + skipped + aborted + running + pending,
    passed,
    failed,
    skipped,
    aborted,
    running,
    pending,
    success: judged === 0 ? "—" : formatPercent(passed, judged),
    successNote: SUCCESS_NOTE,
    averageMs: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null,
    latest: real.slice(0, 5),
    last: real[0] ?? null,
  };
}

export function recurringFailures(names: string[]): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const name of names) {
    const key = name.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
}

export function simulatorConnection(ready: boolean | null, running: boolean): { label: string; tone: "ok" | "live" | "bad" | "loading" } {
  if (running) return { label: "Em uso pelo Maestro", tone: "live" };
  if (ready == null) return { label: "Verificando", tone: "loading" };
  return ready ? { label: "Conectado", tone: "ok" } : { label: "Desconectado", tone: "bad" };
}
