import type { ScenarioStatus } from "@/types";

export const STATUS_LABEL: Record<ScenarioStatus | "passed" | "failed" | "aborted" | "running", string> = {
  pending: "Pendente",
  running: "Em execução",
  passed: "Aprovado",
  failed: "Reprovado",
  skipped: "Ignorado",
  aborted: "Interrompido",
};

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || ms < 0 || Number.isNaN(ms)) return "—";
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export function formatWhen(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(date);
}

export function formatPercent(passed: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.round((passed / total) * 1000) / 10}%`;
}

export function elapsedMs(startedAt: string | null, finishedAt: string | null, durationMs: number | null, now: number): number | null {
  if (durationMs != null && finishedAt) return durationMs;
  if (!startedAt) return null;
  const started = Date.parse(startedAt);
  if (Number.isNaN(started)) return null;
  return Math.max(0, now - started);
}
