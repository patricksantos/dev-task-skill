import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { LogStream, LogView, RunMode, RunStatus, RunView, ScenarioView, SuiteId } from "@/types";

interface RunRow {
  id: string;
  project_id: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  environment: string;
  api_label: string;
  app_id: string;
  simulator_udid: string;
  simulator_name: string | null;
  suite: SuiteId;
  suite_label: string;
  mode: RunMode;
  status: RunStatus;
  duration_ms: number | null;
  passed_count: number;
  failed_count: number;
  skipped_count: number;
  aborted_count: number;
  running_count: number;
  pending_count: number;
  total_count: number;
  exit_code: number | null;
  pid: number | null;
  junit_path: string | null;
  error_message: string | null;
}

interface ScenarioRow {
  name: string;
  file: string | null;
  module: string | null;
  status: ScenarioView["status"];
  log_signal: ScenarioView["logSignal"];
  command: string | null;
  log_error: string | null;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  confirmed: number;
  sort_order: number;
}

function toRun(row: RunRow): RunView & { pid: number | null } {
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    environment: row.environment,
    apiLabel: row.api_label,
    appId: row.app_id,
    simulatorUdid: row.simulator_udid,
    simulatorName: row.simulator_name,
    suite: row.suite,
    suiteLabel: row.suite_label,
    mode: row.mode,
    status: row.status,
    durationMs: row.duration_ms,
    passedCount: row.passed_count,
    failedCount: row.failed_count,
    skippedCount: row.skipped_count,
    abortedCount: row.aborted_count,
    runningCount: row.running_count,
    pendingCount: row.pending_count,
    totalCount: row.total_count,
    exitCode: row.exit_code,
    junitPath: row.junit_path,
    errorMessage: row.error_message,
    pid: row.pid,
  };
}

function toScenario(row: ScenarioRow): ScenarioView {
  return {
    name: row.name,
    file: row.file,
    module: row.module,
    status: row.status,
    logSignal: row.log_signal,
    command: row.command,
    logError: row.log_error,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationMs: row.duration_ms,
    confirmed: row.confirmed === 1,
    sortOrder: row.sort_order,
  };
}

export class RunStore {
  private readonly db: DatabaseSync;

  constructor(dataDir: string) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.db = new DatabaseSync(path.join(dataDir, "maestro-qa.sqlite"));
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 3000;
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT,
        environment TEXT NOT NULL,
        api_label TEXT NOT NULL,
        app_id TEXT NOT NULL,
        simulator_udid TEXT NOT NULL,
        simulator_name TEXT,
        suite TEXT NOT NULL,
        suite_label TEXT NOT NULL,
        mode TEXT NOT NULL,
        status TEXT NOT NULL,
        duration_ms INTEGER,
        passed_count INTEGER NOT NULL DEFAULT 0,
        failed_count INTEGER NOT NULL DEFAULT 0,
        skipped_count INTEGER NOT NULL DEFAULT 0,
        aborted_count INTEGER NOT NULL DEFAULT 0,
        running_count INTEGER NOT NULL DEFAULT 0,
        pending_count INTEGER NOT NULL DEFAULT 0,
        total_count INTEGER NOT NULL DEFAULT 0,
        exit_code INTEGER,
        pid INTEGER,
        junit_path TEXT,
        error_message TEXT
      );
      CREATE TABLE IF NOT EXISTS scenarios (
        run_id TEXT NOT NULL,
        name TEXT NOT NULL,
        file TEXT,
        module TEXT,
        status TEXT NOT NULL,
        log_signal TEXT NOT NULL,
        command TEXT,
        log_error TEXT,
        error_message TEXT,
        started_at TEXT,
        finished_at TEXT,
        duration_ms INTEGER,
        confirmed INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL,
        PRIMARY KEY (run_id, name)
      );
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        scenario_name TEXT,
        stream TEXT NOT NULL,
        ts TEXT NOT NULL,
        line TEXT NOT NULL,
        command TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_runs_created ON runs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_runs_project ON runs(project_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_logs_run ON logs(run_id, id);
    `);
    this.ensureProjectColumn();
  }

  private ensureProjectColumn(): void {
    const columns = this.db.prepare("PRAGMA table_info(runs)").all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === "project_id")) {
      this.db.exec("ALTER TABLE runs ADD COLUMN project_id TEXT");
    }
  }

  insertRun(run: RunView, pid: number | null): void {
    this.db
      .prepare(
        `INSERT INTO runs (
          id, project_id, created_at, started_at, finished_at, environment, api_label, app_id, simulator_udid,
          simulator_name, suite, suite_label, mode, status, duration_ms, passed_count, failed_count,
          skipped_count, aborted_count, running_count, pending_count, total_count, exit_code, pid,
          junit_path, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        run.id,
        run.projectId,
        run.createdAt,
        run.startedAt,
        run.finishedAt,
        run.environment,
        run.apiLabel,
        run.appId,
        run.simulatorUdid,
        run.simulatorName,
        run.suite,
        run.suiteLabel,
        run.mode,
        run.status,
        run.durationMs,
        run.passedCount,
        run.failedCount,
        run.skippedCount,
        run.abortedCount,
        run.runningCount,
        run.pendingCount,
        run.totalCount,
        run.exitCode,
        pid,
        run.junitPath,
        run.errorMessage,
      );
  }

  updateRun(run: RunView, pid: number | null): void {
    this.db
      .prepare(
        `UPDATE runs SET
          started_at = ?, finished_at = ?, simulator_name = ?, status = ?, duration_ms = ?,
          passed_count = ?, failed_count = ?, skipped_count = ?, aborted_count = ?, running_count = ?,
          pending_count = ?, total_count = ?, exit_code = ?, pid = ?, junit_path = ?, error_message = ?
        WHERE id = ?`,
      )
      .run(
        run.startedAt,
        run.finishedAt,
        run.simulatorName,
        run.status,
        run.durationMs,
        run.passedCount,
        run.failedCount,
        run.skippedCount,
        run.abortedCount,
        run.runningCount,
        run.pendingCount,
        run.totalCount,
        run.exitCode,
        pid,
        run.junitPath,
        run.errorMessage,
        run.id,
      );
  }

  saveScenarios(runId: string, scenarios: ScenarioView[]): void {
    this.db.exec("BEGIN");
    try {
      this.db.prepare("DELETE FROM scenarios WHERE run_id = ?").run(runId);
      const insert = this.db.prepare(
        `INSERT INTO scenarios (
          run_id, name, file, module, status, log_signal, command, log_error, error_message,
          started_at, finished_at, duration_ms, confirmed, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const scenario of scenarios) {
        insert.run(
          runId,
          scenario.name,
          scenario.file,
          scenario.module,
          scenario.status,
          scenario.logSignal,
          scenario.command,
          scenario.logError,
          scenario.errorMessage,
          scenario.startedAt,
          scenario.finishedAt,
          scenario.durationMs,
          scenario.confirmed ? 1 : 0,
          scenario.sortOrder,
        );
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  insertLog(entry: Omit<LogView, "id">): LogView {
    const result = this.db
      .prepare(
        `INSERT INTO logs (run_id, scenario_name, stream, ts, line, command) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(entry.runId, entry.scenarioName, entry.stream, entry.ts, entry.line, entry.command);
    return { ...entry, id: Number(result.lastInsertRowid) };
  }

  countLogs(runId: string): number {
    const row = this.db.prepare("SELECT COUNT(*) AS total FROM logs WHERE run_id = ?").get(runId) as { total: number };
    return row.total;
  }

  getRun(id: string): (RunView & { pid: number | null }) | null {
    const row = this.db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as RunRow | undefined;
    return row ? toRun(row) : null;
  }

  latestRun(projectId?: string | null): (RunView & { pid: number | null }) | null {
    const row = (
      projectId
        ? this.db.prepare("SELECT * FROM runs WHERE project_id = ? ORDER BY created_at DESC LIMIT 1").get(projectId)
        : this.db.prepare("SELECT * FROM runs ORDER BY created_at DESC LIMIT 1").get()
    ) as RunRow | undefined;
    return row ? toRun(row) : null;
  }

  listRuns(limit = 30, projectId?: string | null): RunView[] {
    const rows = (
      projectId
        ? this.db
            .prepare("SELECT * FROM runs WHERE project_id = ? ORDER BY created_at DESC LIMIT ?")
            .all(projectId, limit)
        : this.db.prepare("SELECT * FROM runs ORDER BY created_at DESC LIMIT ?").all(limit)
    ) as unknown as RunRow[];
    return rows.map((row) => {
      const run = toRun(row);
      const { pid: _pid, ...view } = run;
      return view;
    });
  }

  listRunning(): Array<RunView & { pid: number | null }> {
    const rows = this.db.prepare("SELECT * FROM runs WHERE status = 'running'").all() as unknown as RunRow[];
    return rows.map(toRun);
  }

  listScenarios(runId: string): ScenarioView[] {
    const rows = this.db
      .prepare("SELECT * FROM scenarios WHERE run_id = ? ORDER BY sort_order ASC")
      .all(runId) as unknown as ScenarioRow[];
    return rows.map(toScenario);
  }

  listLogs(runId: string, limit = 400): LogView[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM (
          SELECT id, run_id, scenario_name, stream, ts, line, command
          FROM logs WHERE run_id = ? ORDER BY id DESC LIMIT ?
        ) ORDER BY id ASC`,
      )
      .all(runId, limit) as unknown as Array<{
      id: number;
      run_id: string;
      scenario_name: string | null;
      stream: LogStream;
      ts: string;
      line: string;
      command: string | null;
    }>;
    return rows.map((row) => ({
      id: row.id,
      runId: row.run_id,
      scenarioName: row.scenario_name,
      stream: row.stream,
      ts: row.ts,
      line: row.line,
      command: row.command,
    }));
  }
}
