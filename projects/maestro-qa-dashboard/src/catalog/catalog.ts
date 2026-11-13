import fs from "node:fs";
import path from "node:path";
import { resolveProject } from "@/project";
import type { CatalogFlow, CatalogModule, CatalogReport } from "@/types";

const FLOW_PATTERN = /\.maestro\/flows\/[A-Za-z0-9_./-]+\.yaml/g;
const MODULE_LABELS: Record<string, string> = {
  smoke: "Smoke",
  stores: "Lojas",
  coupons: "Cupons",
  navigation: "Navegação",
};
const MODULE_ORDER = ["smoke", "stores", "coupons", "navigation"];

export interface PlannedFlow {
  name: string;
  file: string;
  module: string;
}

const STATIC_FLOWS: Record<string, string[]> = {
  smoke: [
    ".maestro/flows/smoke/home.yaml",
    ".maestro/flows/smoke/home_to_stores.yaml",
    ".maestro/flows/smoke/home_to_coupons.yaml",
    ".maestro/flows/smoke/return_home.yaml",
  ],
  coupons: [".maestro/flows/coupons/categories.yaml"],
  navigation: [".maestro/flows/navigation/coupons_and_stores_tabs.yaml"],
  stores: [
    ".maestro/flows/stores/listing.yaml",
    ".maestro/flows/stores/search.yaml",
    ".maestro/flows/stores/views.yaml",
    ".maestro/flows/stores/state.yaml",
    ".maestro/flows/stores/details.yaml",
  ],
  all: [
    ".maestro/flows/smoke/home.yaml",
    ".maestro/flows/smoke/home_to_stores.yaml",
    ".maestro/flows/smoke/home_to_coupons.yaml",
    ".maestro/flows/smoke/return_home.yaml",
    ".maestro/flows/coupons/categories.yaml",
    ".maestro/flows/navigation/coupons_and_stores_tabs.yaml",
    ".maestro/flows/stores/listing.yaml",
    ".maestro/flows/stores/search.yaml",
    ".maestro/flows/stores/views.yaml",
    ".maestro/flows/stores/state.yaml",
    ".maestro/flows/stores/details.yaml",
  ],
};

function toPlanned(file: string): PlannedFlow | null {
  if (!/^\.maestro\/flows\/[A-Za-z0-9_./-]+\.yaml$/.test(file)) return null;
  const parts = file.split("/");
  const moduleName = parts.length > 3 ? parts[2] ?? "flows" : "flows";
  const name = path.basename(file, ".yaml");
  return { name, file, module: moduleName };
}

function listFlowFiles(repoRoot: string, relativeDir: string): PlannedFlow[] {
  const flowsRoot = path.resolve(repoRoot, ".maestro", "flows");
  const start = path.resolve(repoRoot, relativeDir);
  if (start !== flowsRoot && !start.startsWith(`${flowsRoot}${path.sep}`)) return [];
  const flows: PlannedFlow[] = [];
  const walk = (directory: string) => {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith("_") || entry.name === "templates") continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".yaml")) continue;
      const relative = path.relative(repoRoot, absolute).split(path.sep).join("/");
      const planned = toPlanned(relative);
      if (planned) flows.push(planned);
    }
  };
  walk(start);
  return flows;
}

export function readPlannedFlows(repoRoot: string, scriptRelative: string): PlannedFlow[] {
  const scriptPath = path.resolve(repoRoot, scriptRelative);
  const scriptsDir = path.resolve(repoRoot, "scripts");
  if (!scriptPath.startsWith(`${scriptsDir}${path.sep}`)) return [];
  let source = "";
  try {
    source = fs.readFileSync(scriptPath, "utf8");
  } catch {
    return [];
  }
  const found = source.match(FLOW_PATTERN) ?? [];
  const flows: PlannedFlow[] = [];
  const seen = new Set<string>();
  for (const file of found) {
    if (seen.has(file)) continue;
    seen.add(file);
    const planned = toPlanned(file);
    if (!planned) continue;
    const absolute = path.resolve(repoRoot, planned.file);
    const flowsRoot = path.resolve(repoRoot, ".maestro", "flows");
    if (!absolute.startsWith(`${flowsRoot}${path.sep}`)) continue;
    flows.push(planned);
  }
  return flows;
}

export function plannedFlowsForSuite(repoRoot: string, suite: string): PlannedFlow[] {
  if (!path.isAbsolute(repoRoot)) {
    return (STATIC_FLOWS[suite] ?? []).map((file) => toPlanned(file)).filter((flow): flow is PlannedFlow => flow !== null);
  }
  const project = resolveProject(repoRoot);
  const selected = project.suites.find((item) => item.id === suite);
  if (selected?.kind === "script" && selected.script) {
    const fromScript = readPlannedFlows(repoRoot, selected.script);
    if (fromScript.length) return fromScript;
  }
  if (selected?.kind === "maestro" && selected.target) return listFlowFiles(repoRoot, selected.target);
  return (STATIC_FLOWS[suite] ?? []).map((file) => toPlanned(file)).filter((flow): flow is PlannedFlow => flow !== null);
}

function moduleLabel(moduleName: string): string {
  return MODULE_LABELS[moduleName] ?? moduleName;
}

export function readCatalog(repoRoot: string): CatalogReport {
  if (!path.isAbsolute(repoRoot)) {
    return { modules: [], suites: [], error: "MAESTRO_REPO não está configurado." };
  }
  const project = resolveProject(repoRoot);
  const suites = project.suites.map((suite) => ({ id: suite.id, label: suite.label }));
  const flowsRoot = path.join(repoRoot, ".maestro", "flows");
  if (!fs.existsSync(flowsRoot)) {
    return { modules: [], suites, error: project.driver === "scripts" ? null : "A pasta .maestro/flows não está acessível." };
  }

  const suiteMembership = new Map<string, string[]>();
  if (project.driver === "scripts") {
    for (const suite of project.suites) {
      if (!suite.script) continue;
      for (const flow of readPlannedFlows(repoRoot, suite.script)) {
        const current = suiteMembership.get(flow.file) ?? [];
        current.push(suite.id);
        suiteMembership.set(flow.file, current);
      }
    }
  } else {
    for (const flow of listFlowFiles(repoRoot, ".maestro/flows")) {
      const membership = ["all"];
      if (flow.module !== "flows") membership.push(flow.module);
      suiteMembership.set(flow.file, membership);
    }
  }

  const discovered: CatalogFlow[] = [];
  const walk = (directory: string) => {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith("_") || entry.name === "templates") continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".yaml")) continue;
      const relative = path.relative(repoRoot, absolute).split(path.sep).join("/");
      const planned = toPlanned(relative);
      if (!planned) continue;
      discovered.push({
        name: planned.name,
        file: planned.file,
        module: planned.module,
        moduleLabel: moduleLabel(planned.module),
        suites: suiteMembership.get(planned.file) ?? [],
      });
    }
  };
  walk(flowsRoot);

  const grouped = new Map<string, CatalogFlow[]>();
  for (const flow of discovered) {
    const list = grouped.get(flow.module) ?? [];
    list.push(flow);
    grouped.set(flow.module, list);
  }

  const modules: CatalogModule[] = [...grouped.entries()]
    .sort((left, right) => {
      const leftIndex = MODULE_ORDER.indexOf(left[0]);
      const rightIndex = MODULE_ORDER.indexOf(right[0]);
      const normalizedLeft = leftIndex === -1 ? 99 : leftIndex;
      const normalizedRight = rightIndex === -1 ? 99 : rightIndex;
      return normalizedLeft - normalizedRight || left[0].localeCompare(right[0]);
    })
    .map(([id, flows]) => ({
      id,
      label: moduleLabel(id),
      flows: flows.sort((left, right) => left.file.localeCompare(right.file)),
    }));

  return { modules, suites, error: null };
}
