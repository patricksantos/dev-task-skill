import type { ParsedJunit } from "@/junit/junit-report";
import type { RunStatus, ScenarioView } from "@/types";

export interface ProcessOutcome {
  exitCode: number | null;
  aborted: boolean;
  finishedAt: string;
}

function sameFlow(scenario: ScenarioView, testcase: { name: string; file: string | null }): boolean {
  if (scenario.name === testcase.name) return true;
  if (scenario.file && testcase.file && (scenario.file === testcase.file || scenario.file.endsWith(testcase.file))) {
    return true;
  }
  return false;
}

function durationFrom(scenario: ScenarioView, finishedAt: string, seconds: number | null): number | null {
  if (seconds != null && Number.isFinite(seconds)) return Math.round(seconds * 1000);
  if (!scenario.startedAt) return scenario.durationMs;
  const started = Date.parse(scenario.startedAt);
  const finished = Date.parse(finishedAt);
  if (Number.isNaN(started) || Number.isNaN(finished)) return scenario.durationMs;
  return Math.max(0, finished - started);
}

export function reconcileScenarios(
  scenarios: ScenarioView[],
  junit: ParsedJunit | null,
  outcome: ProcessOutcome,
): ScenarioView[] {
  return scenarios.map((scenario) => {
    const next: ScenarioView = { ...scenario };
    const found = junit?.cases.find((testcase) => sameFlow(next, testcase));
    if (found) {
      next.status = outcome.aborted && found.status !== "passed" && found.status !== "failed" ? "aborted" : found.status;
      next.confirmed = true;
      next.finishedAt = found.timestamp ?? outcome.finishedAt;
      next.durationMs = durationFrom(next, outcome.finishedAt, found.timeSeconds);
      next.errorMessage = found.failure;
      return next;
    }

    if (outcome.aborted) {
      if (next.status === "pending" || next.status === "running") {
        next.status = "aborted";
        next.confirmed = true;
        next.finishedAt = outcome.finishedAt;
        next.durationMs = durationFrom(next, outcome.finishedAt, null);
      }
      return next;
    }

    if (!junit && outcome.exitCode === 0) {
      next.status = "passed";
      next.confirmed = true;
      next.finishedAt = outcome.finishedAt;
      next.durationMs = durationFrom(next, outcome.finishedAt, null);
      next.errorMessage = null;
      return next;
    }

    if (next.status === "running") {
      next.status = "failed";
      next.confirmed = true;
      next.errorMessage = "O processo encerrou sem resultado JUnit para este cenário.";
    } else if (next.status === "pending") {
      next.status = "skipped";
      next.confirmed = true;
    }
    next.finishedAt = outcome.finishedAt;
    next.durationMs = durationFrom(next, outcome.finishedAt, null);
    return next;
  });
}

export function suiteStatus(
  scenarios: ScenarioView[],
  outcome: ProcessOutcome,
  junit: ParsedJunit | null,
): RunStatus {
  if (outcome.aborted) return "aborted";
  if (scenarios.some((scenario) => scenario.status === "failed")) return "failed";
  if (outcome.exitCode !== 0 && outcome.exitCode !== null) return "failed";
  if (!junit && outcome.exitCode === null) return "failed";
  return "passed";
}

export function countScenarios(scenarios: ScenarioView[]) {
  return {
    totalCount: scenarios.length,
    passedCount: scenarios.filter((scenario) => scenario.status === "passed").length,
    failedCount: scenarios.filter((scenario) => scenario.status === "failed").length,
    skippedCount: scenarios.filter((scenario) => scenario.status === "skipped").length,
    abortedCount: scenarios.filter((scenario) => scenario.status === "aborted").length,
    runningCount: scenarios.filter((scenario) => scenario.status === "running").length,
    pendingCount: scenarios.filter((scenario) => scenario.status === "pending").length,
  };
}
