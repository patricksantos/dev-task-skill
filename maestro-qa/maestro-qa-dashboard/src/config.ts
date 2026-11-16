import os from "node:os";
import path from "node:path";
import { resolveProject, safeApiUrl } from "@/project";

export interface AppConfig {
  projectRoot: string;
  dataDir: string;
  repoRoot: string;
  maestroBin: string;
  simulatorUdid: string;
  appId: string;
  projectName: string;
  apiUrl: string | null;
  environmentLabel: string;
  apiLabel: string;
}


const UDID_PATTERN = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/;
const ANDROID_SERIAL = /^(?=.*\d)[A-Za-z0-9._:-]{2,80}$/;

function safeAbsolutePath(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  if (!path.isAbsolute(value)) return fallback;
  if (/[\0\n\r;&|`$<>\\]/.test(value)) return fallback;
  return value;
}

export function loadConfig(overrides?: Partial<AppConfig> & { apiUrl?: string | null }): AppConfig {
  const projectRoot = overrides?.projectRoot ?? process.cwd();
  const fallbackBin = path.join(os.homedir(), ".maestro", "bin", "maestro");
  const repoRoot = safeAbsolutePath(overrides?.repoRoot ?? process.env.MAESTRO_REPO, "");
  const project = resolveProject(repoRoot);
  const requestedDevice = overrides?.simulatorUdid ?? process.env.MAESTRO_UDID;
  const simulatorUdid =
    requestedDevice && (UDID_PATTERN.test(requestedDevice) || ANDROID_SERIAL.test(requestedDevice))
      ? requestedDevice
      : "";
  return {
    projectRoot,
    dataDir: overrides?.dataDir ?? path.join(projectRoot, "data"),
    repoRoot,
    maestroBin: safeAbsolutePath(overrides?.maestroBin ?? process.env.MAESTRO_BIN, fallbackBin),
    simulatorUdid,
    appId: overrides?.appId ?? project.appId,
    projectName: overrides?.projectName ?? project.name,
    apiUrl: overrides && "apiUrl" in overrides ? safeApiUrl(overrides.apiUrl ?? undefined, null) : project.apiUrl,
    environmentLabel: project.environmentLabel,
    apiLabel: project.apiLabel,
  };
}

export function assertApiUrl(url: string): void {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new Error("A verificação de rede aceita apenas HTTPS sem credencial.");
  }
}
