import fs from "node:fs";
import path from "node:path";
import { SUITES } from "@/suites";

const SUITE_ID = /^[a-z][a-z0-9_-]{0,40}$/;
const APP_ID = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/;
const MODULE_LABELS: Record<string, string> = {
  all: "Todos",
  smoke: "Smoke",
  stores: "Lojas",
  coupons: "Cupons",
  navigation: "Navegação",
};

export interface ProjectSuite {
  id: string;
  label: string;
  kind: "script" | "maestro";
  script: string | null;
  target: string | null;
  report: string;
}

export interface ProjectProfile {
  name: string;
  appId: string;
  apiUrl: string | null;
  apiLabel: string;
  environmentLabel: string;
  driver: "scripts" | "flows";
  suites: ProjectSuite[];
}

export function safeApiUrl(value: string | undefined, fallback: string | null): string | null {
  if (value == null || value.trim() === "") return fallback;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return fallback;
    return url.toString();
  } catch {
    return fallback;
  }
}

function readable(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function scriptSuites(repoRoot: string): ProjectSuite[] {
  return Object.values(SUITES)
    .filter((suite) => readable(path.join(repoRoot, suite.script)))
    .map((suite) => ({
      id: suite.id,
      label: suite.label,
      kind: "script" as const,
      script: suite.script,
      target: null,
      report: suite.report,
    }));
}

function listDirectories(flowsRoot: string): string[] {
  try {
    return fs
      .readdirSync(flowsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_") && entry.name !== "templates")
      .map((entry) => entry.name)
      .filter((name) => SUITE_ID.test(name) && name !== "all");
  } catch {
    return [];
  }
}

function directoryHasFlow(directory: string): boolean {
  const walk = (current: string): boolean => {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return false;
    }
    return entries.some((entry) => {
      if (entry.name.startsWith("_") || entry.name === "templates") return false;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) return walk(absolute);
      return entry.isFile() && entry.name.endsWith(".yaml");
    });
  };
  return walk(directory);
}

function flowSuites(repoRoot: string): ProjectSuite[] {
  const flowsRoot = path.join(repoRoot, ".maestro", "flows");
  if (!directoryHasFlow(flowsRoot)) return [];
  const modules = listDirectories(flowsRoot).filter((name) => directoryHasFlow(path.join(flowsRoot, name)));
  return [
    {
      id: "all",
      label: "Todos",
      kind: "maestro",
      script: null,
      target: ".maestro/flows",
      report: ".maestro/reports/all.xml",
    },
    ...modules.map((name) => ({
      id: name,
      label: MODULE_LABELS[name] ?? name,
      kind: "maestro" as const,
      script: null,
      target: `.maestro/flows/${name}`,
      report: `.maestro/reports/${name}.xml`,
    })),
  ];
}

function readAppId(repoRoot: string): string | null {
  const flowsRoot = path.join(repoRoot, ".maestro", "flows");
  const files: string[] = [];
  const walk = (directory: string) => {
    if (files.length >= 20) return;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (files.length >= 20 || entry.name.startsWith("_") || entry.name === "templates") continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile() && entry.name.endsWith(".yaml")) files.push(absolute);
    }
  };
  walk(flowsRoot);
  for (const file of files) {
    try {
      const match = fs.readFileSync(file, "utf8").match(/^appId:\s*["']?([A-Za-z0-9._-]+)/m);
      if (match?.[1] && APP_ID.test(match[1])) return match[1];
    } catch {
      continue;
    }
  }
  return null;
}

function cleanName(value: string | undefined, fallback: string): string {
  const trimmed = value?.replace(/[\r\n\0]/g, " ").trim() ?? "";
  if (!trimmed || trimmed.length > 80) return fallback;
  return trimmed;
}

export function resolveProject(repoRoot: string, env: Record<string, string | undefined> = process.env): ProjectProfile {
  if (!repoRoot || !path.isAbsolute(repoRoot)) {
    const requestedApp = env.MAESTRO_APP_ID?.trim();
    return {
      name: cleanName(env.MAESTRO_PROJECT_NAME, "Projeto"),
      appId: requestedApp && APP_ID.test(requestedApp) ? requestedApp : "app",
      apiUrl: safeApiUrl(env.MAESTRO_API_URL, null),
      apiLabel: cleanName(env.MAESTRO_API_LABEL, "API"),
      environmentLabel: cleanName(env.MAESTRO_ENV_LABEL, "dev"),
      driver: "flows",
      suites: [],
    };
  }
  const scripts = scriptSuites(repoRoot);
  const suites = scripts.length > 0 ? scripts : flowSuites(repoRoot);
  const requestedApp = env.MAESTRO_APP_ID?.trim();
  const fallbackApp = readAppId(repoRoot) ?? "app";
  return {
    name: cleanName(env.MAESTRO_PROJECT_NAME, path.basename(repoRoot) || "Projeto"),
    appId: requestedApp && APP_ID.test(requestedApp) ? requestedApp : fallbackApp,
    apiUrl: safeApiUrl(env.MAESTRO_API_URL, null),
    apiLabel: cleanName(env.MAESTRO_API_LABEL, "API"),
    environmentLabel: cleanName(env.MAESTRO_ENV_LABEL, "dev"),
    driver: scripts.length > 0 ? "scripts" : "flows",
    suites,
  };
}

export function isSuiteId(value: string): boolean {
  return SUITE_ID.test(value);
}
