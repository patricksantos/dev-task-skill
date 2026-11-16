import { loadConfig } from "@/config";
import { ProjectRegistry } from "@/projects/registry";
import { RunManager } from "@/runner/run-manager";

const globalStore = globalThis as typeof globalThis & { __maestroQa?: RunManager };

export function getRunManager(): RunManager {
  if (!globalStore.__maestroQa) {
    const config = loadConfig();
    const registry = new ProjectRegistry(config.dataDir);
    globalStore.__maestroQa = new RunManager({ config, registry });
  }
  return globalStore.__maestroQa;
}
