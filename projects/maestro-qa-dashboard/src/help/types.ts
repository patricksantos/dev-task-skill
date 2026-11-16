export type HelpCategory =
  | "comecar"
  | "configurar"
  | "executar"
  | "analisar"
  | "agentes"
  | "seguranca";

export type HelpBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string; id?: string }
  | { type: "h3"; text: string; id?: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "code"; code: string; label?: string }
  | { type: "callout"; tone: "info" | "warn" | "ok"; title?: string; text: string }
  | { type: "steps"; items: Array<{ title: string; text: string }> }
  | { type: "table"; headers: string[]; rows: string[][] };

export interface HelpArticle {
  slug: string;
  title: string;
  summary: string;
  category: HelpCategory;
  related: string[];
  blocks: HelpBlock[];
}

export interface HelpCategoryInfo {
  id: HelpCategory;
  label: string;
  detail: string;
}

export interface OnboardingStep {
  id: "project" | "environment" | "target" | "suites" | "run";
  title: string;
  detail: string;
  done: boolean;
  page: "projects" | "settings" | "executions" | "history";
  article: string;
  action: string;
}
