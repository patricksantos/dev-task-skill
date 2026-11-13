import { sanitizeText } from "@/sanitize/sanitize";
import type { LogSignal, ScenarioView } from "@/types";

export interface LineEffect {
  changed: boolean;
  deviceName: string | null;
  scenarioName: string | null;
  command: string | null;
}

function effect(partial: Partial<LineEffect> = {}): LineEffect {
  return { changed: false, deviceName: null, scenarioName: null, command: null, ...partial };
}

const FLOW_LINE = /^\s*(?:║\s*)?>\s*Flow\b[:\s]*(.*?)\s*$/i;
const COMMAND_DONE =
  /^\s*(?:║\s*)?(?:[✅❌⚠️]\s*)?(.+?)\s*\.\.\.\s*(COMPLETED|FAILED|WARNED|SKIPPED|PENDING)\s*$/iu;
const BOX_MARK = /^\s*║\s*([✅❌⚠️])\s+(.+?)\s*$/u;
const RUNNING_ON = /^\s*Running on\s+(.+?)\s*$/i;
const SUMMARY = /^\s*\[(Passed|Failed|Skipped)\]\s+(.+?)\s*$/i;
const ERROR_LINE =
  /^(Assertion is false|Element not found|Unable to|No visible element|Command failed)\b/i;
const COMMAND_START =
  /^(Launch app|Tap on|Double tap|Long press|Assert that|Assert not|Input text|Erase text|Run |Swipe|Scroll|Press |Hide keyboard|Wait |Copy |Paste |Take screenshot|Open |Kill |Stop |Repeat |Retry |Toggle |Run flow|Extended wait|Navigate)\b/i;

function signalFromOutcome(outcome: string): LogSignal {
  const value = outcome.toUpperCase();
  if (value === "COMPLETED" || value === "PASSED") return "passed";
  if (value === "FAILED") return "failed";
  if (value === "SKIPPED" || value === "WARNED") return "skipped";
  return "running";
}

function signalFromMark(mark: string): LogSignal {
  if (mark === "✅") return "passed";
  if (mark === "❌") return "failed";
  return "skipped";
}

function normalizeFlowName(raw: string): string {
  const trimmed = raw.trim().replace(/\.ya?ml$/i, "");
  if (!trimmed) return "";
  const parts = trimmed.split("/");
  return parts[parts.length - 1] ?? "";
}

function findScenario(scenarios: ScenarioView[], raw: string): ScenarioView | undefined {
  const name = normalizeFlowName(raw);
  if (!name) return undefined;
  return scenarios.find(
    (scenario) =>
      scenario.name === name ||
      scenario.file === raw.trim() ||
      scenario.file?.endsWith(`/${name}.yaml`) === true,
  );
}

function nextPending(scenarios: ScenarioView[]): ScenarioView | undefined {
  return scenarios.find((scenario) => scenario.status === "pending");
}

function currentRunning(scenarios: ScenarioView[]): ScenarioView | undefined {
  for (let index = scenarios.length - 1; index >= 0; index -= 1) {
    if (scenarios[index]?.status === "running") return scenarios[index];
  }
  return undefined;
}

function markRunning(scenario: ScenarioView, now: string): void {
  if (scenario.status === "pending") {
    scenario.status = "running";
    scenario.startedAt = now;
    scenario.logSignal = "running";
  }
}

export function applyMaestroLine(rawLine: string, scenarios: ScenarioView[], now: string): LineEffect {
  const line = sanitizeText(rawLine).trim();
  if (!line) return effect();

  const runningOn = line.match(RUNNING_ON);
  if (runningOn?.[1]) {
    return effect({ changed: true, deviceName: runningOn[1].trim() });
  }

  const flow = line.match(FLOW_LINE);
  if (flow) {
    const named = flow[1] ? findScenario(scenarios, flow[1]) : undefined;
    const scenario = named ?? (flow[1]?.trim() ? undefined : nextPending(scenarios));
    if (scenario) {
      markRunning(scenario, now);
      return effect({ changed: true, scenarioName: scenario.name });
    }
    if (flow[1]?.trim()) {
      const name = normalizeFlowName(flow[1]);
      scenarios.push({
        name,
        file: null,
        module: null,
        status: "running",
        logSignal: "running",
        command: null,
        logError: null,
        errorMessage: null,
        startedAt: now,
        finishedAt: null,
        durationMs: null,
        confirmed: false,
        sortOrder: scenarios.length,
      });
      return effect({ changed: true, scenarioName: name });
    }
    return effect();
  }

  const summary = line.match(SUMMARY);
  if (summary?.[1] && summary[2]) {
    const scenario = findScenario(scenarios, summary[2]);
    if (!scenario) return effect();
    scenario.logSignal = signalFromOutcome(summary[1] === "Passed" ? "COMPLETED" : summary[1]);
    return effect({ changed: true, scenarioName: scenario.name });
  }

  const done = line.match(COMMAND_DONE);
  if (done?.[1] && done[2]) {
    const scenario = currentRunning(scenarios);
    if (!scenario) return effect();
    const command = done[1].trim();
    scenario.command = command;
    scenario.logSignal = signalFromOutcome(done[2]);
    return effect({ changed: true, scenarioName: scenario.name, command });
  }

  const boxed = line.match(BOX_MARK);
  if (boxed?.[1] && boxed[2] && !/^>\s*Flow\b/i.test(boxed[2])) {
    const scenario = currentRunning(scenarios);
    if (!scenario) return effect();
    const command = boxed[2].trim();
    scenario.command = command;
    scenario.logSignal = signalFromMark(boxed[1]);
    return effect({ changed: true, scenarioName: scenario.name, command });
  }

  if (ERROR_LINE.test(line)) {
    const scenario = currentRunning(scenarios);
    if (!scenario) return effect();
    scenario.logError = line;
    return effect({ changed: true, scenarioName: scenario.name });
  }

  if (COMMAND_START.test(line)) {
    const scenario = currentRunning(scenarios);
    if (!scenario) return effect();
    const command = line.replace(/\s*\.\.\.\s*$/, "").trim();
    scenario.command = command;
    if (scenario.logSignal === "none") scenario.logSignal = "running";
    return effect({ changed: true, scenarioName: scenario.name, command });
  }

  return effect({ scenarioName: currentRunning(scenarios)?.name ?? null });
}
