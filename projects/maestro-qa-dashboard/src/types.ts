export const SUITE_IDS = ["all", "smoke", "stores", "coupons", "navigation"] as const;

export type SuiteId = string;

export type RunMode = "script" | "fixture";

export type ScenarioStatus = "pending" | "running" | "passed" | "failed" | "skipped" | "aborted";

export type RunStatus = "running" | "passed" | "failed" | "aborted";

export type LogSignal = "none" | "passed" | "failed" | "skipped" | "running";

export type LogStream = "stdout" | "stderr";

export interface ScenarioView {
  name: string;
  file: string | null;
  module: string | null;
  status: ScenarioStatus;
  logSignal: LogSignal;
  command: string | null;
  logError: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  confirmed: boolean;
  sortOrder: number;
}

export interface LogView {
  id: number;
  runId: string;
  scenarioName: string | null;
  stream: LogStream;
  ts: string;
  line: string;
  command: string | null;
}

export interface RunView {
  id: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  environment: string;
  apiLabel: string;
  appId: string;
  simulatorUdid: string;
  simulatorName: string | null;
  suite: SuiteId;
  suiteLabel: string;
  mode: RunMode;
  status: RunStatus;
  durationMs: number | null;
  passedCount: number;
  failedCount: number;
  skippedCount: number;
  abortedCount: number;
  runningCount: number;
  pendingCount: number;
  totalCount: number;
  exitCode: number | null;
  junitPath: string | null;
  errorMessage: string | null;
}

export interface DashboardEvent {
  type: "snapshot" | "state" | "log";
  run: RunView | null;
  scenarios?: ScenarioView[];
  logs?: LogView[];
  log?: LogView;
  serverTime: string;
}

export interface PrerequisiteCheck {
  id: "maestro" | "simulator" | "scripts" | "hml";
  label: string;
  ok: boolean;
  level: "required" | "warning";
  message: string;
}

export interface PrerequisiteReport {
  ready: boolean;
  checkedAt: string;
  environment: string;
  apiLabel: string;
  appId: string;
  projectName: string;
  driver: "scripts" | "flows";
  simulatorUdid: string;
  simulatorName: string | null;
  checks: PrerequisiteCheck[];
}

export interface CatalogFlow {
  name: string;
  file: string;
  module: string;
  moduleLabel: string;
  suites: SuiteId[];
}

export interface CatalogModule {
  id: string;
  label: string;
  flows: CatalogFlow[];
}

export interface CatalogSuite {
  id: string;
  label: string;
}

export interface CatalogReport {
  modules: CatalogModule[];
  suites: CatalogSuite[];
  error: string | null;
}
