import { createElement, type ReactNode } from "react";
import { STATUS_LABEL, formatDuration, formatWhen } from "@/components/format";
import { isFailureLine, moduleLabel, scenarioDuration, showProvisionalBadge } from "@/components/view-model";
import type { FlowAvailability } from "@/components/view-model";
import type { LogView, ScenarioView } from "@/types";

export function ProgressBar({
  confirmed,
  total,
  current,
  command,
  elapsed,
  state,
  demo,
  pending = 0,
  skipped = 0,
}: {
  confirmed: number;
  total: number;
  current: string | null;
  command: string | null;
  elapsed: string;
  state: string;
  demo: boolean;
  pending?: number;
  skipped?: number;
}) {
  const ratio = total === 0 ? 0 : confirmed / total;
  return createElement(
    "section",
    {
      className: demo ? "progress demo" : "progress",
      "data-testid": "progress-bar",
      role: "progressbar",
      "aria-valuemin": 0,
      "aria-valuemax": total,
      "aria-valuenow": confirmed,
      "aria-label": "Cenários confirmados",
    },
    createElement(
      "div",
      { className: "progress-copy" },
      createElement("strong", null, `${confirmed} de ${total} concluídos`),
      createElement("span", null, current ? `Atual: ${current}${command ? ` · ${command}` : ""}` : "Nenhum cenário em execução"),
      createElement("span", null, `Decorrido ${elapsed}`),
      createElement("span", null, `${pending} ${pending === 1 ? "pendente" : "pendentes"}`),
      skipped > 0 ? createElement("span", null, `${skipped} ${skipped === 1 ? "ignorado" : "ignorados"}, fora da taxa`) : null,
      createElement("span", null, state),
    ),
    createElement(
      "div",
      { className: "progress-track" },
      createElement("div", { className: "progress-fill", style: { width: `${ratio * 100}%` } }),
    ),
  );
}

export function ScenarioButton({
  scenario,
  selected,
  now,
  live,
  onSelect,
}: {
  scenario: ScenarioView;
  selected: boolean;
  now: number;
  live: boolean;
  onSelect?: () => void;
}) {
  const provisional = showProvisionalBadge(scenario, live);
  return createElement(
    "button",
    {
      type: "button",
      className: selected ? "scenario selected" : "scenario",
      "data-testid": `scenario-${scenario.name}`,
      "aria-pressed": selected,
      onClick: onSelect,
    },
    createElement("span", {
      className: "status-dot",
      "data-status": provisional ? "running" : scenario.status,
      "aria-hidden": true,
    }),
    createElement(
      "span",
      { className: "scenario-name" },
      createElement("b", null, scenario.name),
      live ? createElement("small", { className: "live-mark" }, "Em execução") : null,
    ),
    createElement("span", { className: "meta" }, moduleLabel(scenario.module)),
    createElement(
      "span",
      { className: provisional ? "status provisional" : "status", "data-status": scenario.status },
      provisional ? "Provisório" : STATUS_LABEL[scenario.status],
    ),
    createElement("span", { className: "scenario-time" }, formatDuration(scenarioDuration(scenario, now))),
    createElement("span", { className: "mono scenario-cmd" }, scenario.command ?? "—"),
  );
}

export function LogLine({ entry }: { entry: LogView }) {
  const failed = isFailureLine(entry.line, entry.stream);
  const clock = formatWhen(entry.ts).split(", ").at(-1) ?? "";
  return createElement(
    "div",
    { className: failed ? `log ${entry.stream} fail` : `log ${entry.stream}` },
    createElement("time", null, clock),
    createElement("span", { className: "stream" }, entry.stream),
    createElement("span", { className: "who" }, entry.scenarioName ?? "suíte"),
    createElement("span", null, entry.line),
  );
}

export function CatalogMark({ name, availability, reason }: { name: string; availability: FlowAvailability; reason?: string }) {
  const label =
    availability === "included"
      ? "Na suíte completa"
      : availability === "blocked"
        ? "Bloqueado"
        : "Disponível, não incluído";
  return createElement("span", { className: `flow ${availability}`, title: reason }, name, " ", createElement("em", null, label));
}

export function CommandList({ steps }: { steps: Array<{ text: string; signal: "passed" | "failed" | "skipped" | "running"; at: string }> }) {
  if (steps.length === 0) {
    return createElement("p", { className: "muted" }, "Nenhum comando associado a este cenário.");
  }
  const label = { passed: "Concluído", failed: "Falhou", skipped: "Ignorado", running: "Em execução" };
  return createElement(
    "ol",
    { className: "commands" },
    ...steps.map((step, index) =>
      createElement(
        "li",
        { key: `${step.at}-${index}` },
        createElement("span", { className: "status", "data-status": step.signal === "passed" ? "passed" : step.signal === "failed" ? "failed" : step.signal === "skipped" ? "skipped" : "running" }, label[step.signal]),
        createElement("span", null, step.text),
      ),
    ),
  );
}
export function HistoryMark({ demo, children }: { demo: boolean; children?: ReactNode }) {
  return createElement(
    "span",
    { className: demo ? "mark demo" : "mark" },
    demo ? "Demonstração" : "Execução real",
    children,
  );
}
