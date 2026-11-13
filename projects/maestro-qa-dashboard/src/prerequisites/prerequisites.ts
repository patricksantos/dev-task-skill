import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { assertApiUrl, type AppConfig } from "@/config";
import { resolveProject } from "@/project";
import type { PrerequisiteCheck, PrerequisiteReport } from "@/types";

const execFileAsync = promisify(execFile);

export interface PrerequisiteDeps {
  fetchImpl?: typeof fetch;
  execFileImpl?: (command: string, args: string[]) => Promise<{ stdout: string }>;
  now?: () => Date;
}

interface SimDevice {
  udid?: string;
  name?: string;
  state?: string;
}

let cache: { at: number; key: string; value: PrerequisiteReport } | null = null;

function isExecutable(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function findDevice(stdout: string, udid: string): SimDevice | null {
  const parsed = JSON.parse(stdout) as { devices?: Record<string, SimDevice[]> };
  for (const devices of Object.values(parsed.devices ?? {})) {
    const found = devices.find((device) => device.udid === udid && device.state === "Booted");
    if (found) return found;
  }
  return null;
}

function findFirstBooted(stdout: string): SimDevice | null {
  const parsed = JSON.parse(stdout) as { devices?: Record<string, SimDevice[]> };
  for (const devices of Object.values(parsed.devices ?? {})) {
    const found = devices.find((device) => device.state === "Booted" && device.udid);
    if (found) return found;
  }
  return null;
}

async function findAndroidDevice(
  execImpl: (command: string, args: string[]) => Promise<{ stdout: string }>,
  serial?: string,
): Promise<string | null> {
  try {
    const listed = await execImpl("adb", ["devices"]);
    const connected = listed.stdout
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.trim().split(/\s+/))
      .filter((parts) => parts[1] === "device" && parts[0]);
    if (serial) return connected.some((parts) => parts[0] === serial) ? serial : null;
    return connected[0]?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function checkPrerequisites(config: AppConfig, deps: PrerequisiteDeps = {}): Promise<PrerequisiteReport> {
  const project = resolveProject(config.repoRoot);
  const cacheKey = `${config.maestroBin}|${config.simulatorUdid}|${config.repoRoot}|${project.apiUrl ?? ""}|${project.suites.map((suite) => suite.id).join(",")}`;
  if (!deps.fetchImpl && !deps.execFileImpl && cache && cache.key === cacheKey && Date.now() - cache.at < 15_000) {
    return cache.value;
  }

  const fetchImpl = deps.fetchImpl ?? fetch;
  const execImpl =
    deps.execFileImpl ??
    (async (command: string, args: string[]) => {
      const result = await execFileAsync(command, args, { timeout: 8_000, encoding: "utf8" });
      return { stdout: result.stdout };
    });
  const now = deps.now ?? (() => new Date());

  const checks: PrerequisiteCheck[] = [];

  checks.push(
    isExecutable(config.maestroBin)
      ? {
          id: "maestro",
          label: "Maestro CLI",
          ok: true,
          level: "required",
          message: "Binário encontrado e executável.",
        }
      : {
          id: "maestro",
          label: "Maestro CLI",
          ok: false,
          level: "required",
          message: "Binário do Maestro não encontrado ou sem permissão de execução.",
        },
  );

  const missingScripts = project.suites
    .filter((suite) => suite.kind === "script" && suite.script)
    .filter((suite) => !isExecutable(path.join(config.repoRoot, suite.script ?? "")));
  const scriptsReady = project.driver === "flows" ? project.suites.length > 0 : project.suites.length > 0 && missingScripts.length === 0;
  checks.push(
    scriptsReady
      ? {
          id: "scripts",
          label: project.driver === "flows" ? "Fluxos Maestro" : "Scripts autorizados",
          ok: true,
          level: "required",
          message:
            project.driver === "flows"
              ? "Os fluxos de .maestro/flows serão executados pelo Maestro CLI."
              : "Os scripts encontrados no repositório estão disponíveis.",
        }
      : {
          id: "scripts",
          label: project.driver === "flows" ? "Fluxos Maestro" : "Scripts autorizados",
          ok: false,
          level: "required",
          message:
            project.driver === "flows"
              ? "Nenhum fluxo .yaml foi encontrado em .maestro/flows."
              : "Há scripts autorizados ausentes ou sem permissão de execução.",
        },
  );

  let simulatorName: string | null = null;
  let simulatorUdid = config.simulatorUdid;
  const iosRequested = /^[0-9A-Fa-f-]{36}$/.test(simulatorUdid);
  if (!simulatorUdid || iosRequested) {
    try {
      const listed = await execImpl("/usr/bin/xcrun", ["simctl", "list", "devices", "booted", "-j"]);
      const device = simulatorUdid
        ? findDevice(listed.stdout, simulatorUdid)
        : findFirstBooted(listed.stdout);
      if (device?.udid) {
        simulatorUdid = device.udid;
        simulatorName = device.name ?? null;
        checks.push({
          id: "simulator",
          label: "Simulador",
          ok: true,
          level: "required",
          message: `${simulatorName ?? "Simulador"} está ligado.`,
        });
      } else if (!simulatorUdid) {
        const android = await findAndroidDevice(execImpl);
        if (android) {
          simulatorUdid = android;
          simulatorName = android;
          checks.push({
            id: "simulator",
            label: "Dispositivo",
            ok: true,
            level: "required",
            message: `Android ${android} está conectado.`,
          });
        } else {
          checks.push({
            id: "simulator",
            label: "Dispositivo",
            ok: false,
            level: "required",
            message: "Nenhum simulador iOS ligado nem dispositivo Android conectado.",
          });
        }
      } else {
        checks.push({
          id: "simulator",
          label: "Simulador",
          ok: false,
          level: "required",
          message: "O simulador configurado não está ligado.",
        });
      }
    } catch {
      checks.push({
        id: "simulator",
        label: "Simulador",
        ok: false,
        level: "required",
        message: "Não foi possível consultar os simuladores pelo simctl.",
      });
    }
  } else {
    const android = await findAndroidDevice(execImpl, simulatorUdid);
    simulatorName = android;
    checks.push({
      id: "simulator",
      label: "Dispositivo",
      ok: Boolean(android),
      level: "required",
      message: android ? `Android ${android} está conectado.` : "O dispositivo Android configurado não está conectado.",
    });
  }

  if (!project.apiUrl) {
    checks.push({
      id: "hml",
      label: "API",
      ok: true,
      level: "warning",
      message: "Nenhuma API de ambiente foi configurada.",
    });
  } else {
    try {
      assertApiUrl(project.apiUrl);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4_000);
      try {
        const response = await fetchImpl(project.apiUrl, {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
          headers: { Accept: "text/plain" },
        });
        checks.push({
          id: "hml",
          label: project.apiLabel,
          ok: true,
          level: "warning",
          message: `A API respondeu HTTP ${response.status}. Nenhuma credencial foi enviada.`,
        });
      } finally {
        clearTimeout(timer);
      }
    } catch {
      checks.push({
        id: "hml",
        label: project.apiLabel,
        ok: false,
        level: "warning",
        message: "A API de ambiente não respondeu.",
      });
    }
  }

  const report: PrerequisiteReport = {
    ready: checks.filter((check) => check.level === "required").every((check) => check.ok),
    checkedAt: now().toISOString(),
    environment: project.environmentLabel,
    apiLabel: project.apiLabel,
    appId: project.appId,
    projectName: project.name,
    driver: project.driver,
    simulatorUdid,
    simulatorName,
    checks,
  };

  if (!deps.fetchImpl && !deps.execFileImpl) {
    cache = { at: Date.now(), key: cacheKey, value: report };
  }
  return report;
}

export async function captureSimulatorScreenshot(udid: string, destination: string): Promise<void> {
  if (/^[0-9A-Fa-f-]{36}$/.test(udid)) {
    await execFileAsync("/usr/bin/xcrun", ["simctl", "io", udid, "screenshot", destination], {
      timeout: 8_000,
    });
    return;
  }
  if (!/^(?=.*\d)[A-Za-z0-9._:-]{2,80}$/.test(udid)) {
    throw new Error("Identificador do dispositivo inválido.");
  }
  const result = await execFileAsync("adb", ["-s", udid, "exec-out", "screencap", "-p"], {
    timeout: 8_000,
    encoding: "buffer",
  });
  fs.writeFileSync(destination, result.stdout);
}
