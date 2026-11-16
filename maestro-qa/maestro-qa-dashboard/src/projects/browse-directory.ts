import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { RequestError } from "@/errors";

const execFileAsync = promisify(execFile);

const PICKER_TIMEOUT_MS = 180_000;
const PROMPT = "Selecione o diretório do app com fluxos Maestro";

export type ExecFileFn = (
  file: string,
  args?: readonly string[] | null,
  options?: { timeout?: number },
) => Promise<{ stdout: string | Buffer; stderr: string | Buffer }>;

function normalizePickedPath(stdout: string): string | null {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/[/\\]+$/, ""))
    .filter(Boolean);
  const picked = lines.at(-1);
  return picked || null;
}

async function pickOnDarwin(execFileFn: ExecFileFn): Promise<string | null> {
  const script = [
    "try",
    `  POSIX path of (choose folder with prompt ${JSON.stringify(PROMPT)})`,
    "on error number -128",
    '  return ""',
    "end try",
  ].join("\n");
  const { stdout } = await execFileFn("osascript", ["-e", script], { timeout: PICKER_TIMEOUT_MS });
  return normalizePickedPath(String(stdout));
}

function isCancelCode(code: unknown): boolean {
  return code === 1 || code === "1";
}

async function pickOnLinux(execFileFn: ExecFileFn): Promise<string | null> {
  try {
    const { stdout } = await execFileFn("zenity", ["--file-selection", "--directory", `--title=${PROMPT}`], {
      timeout: PICKER_TIMEOUT_MS,
    });
    return normalizePickedPath(String(stdout));
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (isCancelCode(err.code)) return null;
    try {
      const { stdout } = await execFileFn("kdialog", ["--getexistingdirectory", ".", PROMPT], {
        timeout: PICKER_TIMEOUT_MS,
      });
      return normalizePickedPath(String(stdout));
    } catch (inner) {
      const innerErr = inner as NodeJS.ErrnoException;
      if (isCancelCode(innerErr.code)) return null;
      throw error;
    }
  }
}

async function pickOnWindows(execFileFn: ExecFileFn): Promise<string | null> {
  const command = [
    "Add-Type -AssemblyName System.Windows.Forms;",
    "$d = New-Object System.Windows.Forms.FolderBrowserDialog;",
    `$d.Description = ${JSON.stringify(PROMPT)};`,
    "$d.ShowNewFolderButton = $false;",
    "if ($d.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { exit 0 };",
    "[Console]::Out.Write($d.SelectedPath)",
  ].join(" ");
  const { stdout } = await execFileFn("powershell.exe", ["-NoProfile", "-STA", "-Command", command], {
    timeout: PICKER_TIMEOUT_MS,
  });
  return normalizePickedPath(String(stdout));
}

export async function pickLocalDirectory(options?: {
  execFile?: ExecFileFn;
  platform?: NodeJS.Platform;
}): Promise<string | null> {
  const execFileFn = options?.execFile ?? execFileAsync;
  const platform = options?.platform ?? process.platform;
  try {
    if (platform === "darwin") return await pickOnDarwin(execFileFn);
    if (platform === "linux") return await pickOnLinux(execFileFn);
    if (platform === "win32") return await pickOnWindows(execFileFn);
  } catch (error) {
    const code = (error as { code?: string | number }).code;
    if (code === 1 || code === "1") return null;
    throw new RequestError(500, "Não foi possível abrir o seletor de pasta do sistema.");
  }
  throw new RequestError(501, "Seletor de pasta nativo indisponível neste sistema.");
}

export { normalizePickedPath };
