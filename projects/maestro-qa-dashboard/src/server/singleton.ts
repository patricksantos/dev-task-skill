import { loadConfig } from "@/config";
import { RunManager } from "@/runner/run-manager";

const globalStore = globalThis as typeof globalThis & { __maestroQa?: RunManager };

export function getRunManager(): RunManager {
  if (!globalStore.__maestroQa) {
    globalStore.__maestroQa = new RunManager({ config: loadConfig() });
  }
  return globalStore.__maestroQa;
}
