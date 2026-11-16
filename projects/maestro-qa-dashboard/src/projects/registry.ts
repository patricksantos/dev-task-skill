import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { readCatalog } from "@/catalog/catalog";
import type { AppConfig } from "@/config";
import { RequestError } from "@/errors";
import { resolveProject, safeApiUrl } from "@/project";
import type { ProjectDiscovery, ProjectType, QaEnvironment, QaProject, WorkspaceState } from "@/projects/types";

const NAME_MAX = 80;
const DESC_MAX = 240;
const TYPES = new Set<ProjectType>(["mobile", "web", "hybrid"]);

interface ProjectRow {
  id: string;
  name: string;
  description: string;
  type: ProjectType;
  repository_path: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

interface EnvironmentRow {
  id: string;
  project_id: string;
  name: string;
  label: string;
  api_url: string | null;
  api_label: string;
  production: number;
  created_at: string;
}

function toProject(row: ProjectRow): QaProject {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    repositoryPath: row.repository_path,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toEnvironment(row: EnvironmentRow): QaEnvironment {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    label: row.label,
    apiUrl: row.api_url,
    apiLabel: row.api_label,
    production: row.production === 1,
    createdAt: row.created_at,
  };
}

export function assertAuthorizedRepoPath(value: string): string {
  if (!path.isAbsolute(value) || /[\0\n\r;&|`$<>]/.test(value)) {
    throw new RequestError(400, "Informe um diretório local absoluto e autorizado.");
  }
  let resolved = value;
  try {
    resolved = fs.realpathSync(value);
  } catch {
    throw new RequestError(400, "O diretório informado não existe ou não pode ser lido.");
  }
  if (!path.isAbsolute(resolved) || /[\0\n\r;&|`$<>]/.test(resolved)) {
    throw new RequestError(400, "Informe um diretório local absoluto e autorizado.");
  }
  let stat: fs.Stats;
  try {
    stat = fs.statSync(resolved);
  } catch {
    throw new RequestError(400, "O diretório informado não existe ou não pode ser lido.");
  }
  if (!stat.isDirectory()) throw new RequestError(400, "O caminho precisa ser um diretório.");
  return resolved;
}

function cleanText(value: unknown, fallback: string, max: number): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.replace(/[\r\n\0]/g, " ").trim();
  if (!trimmed || trimmed.length > max) return fallback;
  return trimmed;
}

export class ProjectRegistry {
  private readonly db: DatabaseSync;

  constructor(dataDir: string) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.db = new DatabaseSync(path.join(dataDir, "maestro-qa.sqlite"));
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 3000;
      CREATE TABLE IF NOT EXISTS qa_projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        type TEXT NOT NULL,
        repository_path TEXT NOT NULL UNIQUE,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS qa_environments (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        label TEXT NOT NULL,
        api_url TEXT,
        api_label TEXT NOT NULL,
        production INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS qa_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    this.ensureRunProjectColumn();
  }

  private ensureRunProjectColumn(): void {
    try {
      const columns = this.db.prepare("PRAGMA table_info(runs)").all() as Array<{ name: string }>;
      if (columns.length === 0) return;
      if (!columns.some((column) => column.name === "project_id")) {
        this.db.exec("ALTER TABLE runs ADD COLUMN project_id TEXT");
      }
    } catch {
      /* runs table may not exist yet */
    }
  }

  listProjects(): QaProject[] {
    const rows = this.db.prepare("SELECT * FROM qa_projects ORDER BY name COLLATE NOCASE").all() as unknown as ProjectRow[];
    return rows.map(toProject);
  }

  getProject(id: string): QaProject | null {
    const row = this.db.prepare("SELECT * FROM qa_projects WHERE id = ?").get(id) as ProjectRow | undefined;
    return row ? toProject(row) : null;
  }

  findByPath(repositoryPath: string): QaProject | null {
    const row = this.db
      .prepare("SELECT * FROM qa_projects WHERE repository_path = ?")
      .get(repositoryPath) as ProjectRow | undefined;
    return row ? toProject(row) : null;
  }

  listEnvironments(projectId: string): QaEnvironment[] {
    const rows = this.db
      .prepare("SELECT * FROM qa_environments WHERE project_id = ? ORDER BY created_at")
      .all(projectId) as unknown as EnvironmentRow[];
    return rows.map(toEnvironment);
  }

  getEnvironment(id: string): QaEnvironment | null {
    const row = this.db.prepare("SELECT * FROM qa_environments WHERE id = ?").get(id) as EnvironmentRow | undefined;
    return row ? toEnvironment(row) : null;
  }

  setting(key: string): string | null {
    const row = this.db.prepare("SELECT value FROM qa_settings WHERE key = ?").get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  setSetting(key: string, value: string): void {
    this.db.prepare("INSERT INTO qa_settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
  }

  workspace(): WorkspaceState {
    const projects = this.listProjects();
    const activeProjectId = this.setting("active_project_id");
    const activeProject = (activeProjectId ? this.getProject(activeProjectId) : null) ?? projects[0] ?? null;
    const environments = activeProject ? this.listEnvironments(activeProject.id) : [];
    const activeEnvironmentId = this.setting("active_environment_id");
    const activeEnvironment =
      (activeEnvironmentId ? environments.find((item) => item.id === activeEnvironmentId) : null) ?? environments[0] ?? null;
    return {
      projects,
      environments,
      activeProjectId: activeProject?.id ?? null,
      activeEnvironmentId: activeEnvironment?.id ?? null,
      activeProject,
      activeEnvironment,
    };
  }

  syncFromConfig(config: Pick<AppConfig, "repoRoot" | "projectName" | "apiUrl" | "apiLabel" | "environmentLabel">): WorkspaceState {
    if (!config.repoRoot) return this.workspace();
    let repositoryPath: string;
    try {
      repositoryPath = assertAuthorizedRepoPath(config.repoRoot);
    } catch {
      return this.workspace();
    }
    const existing = this.findByPath(repositoryPath);
    const now = new Date().toISOString();
    const name = cleanText(config.projectName, path.basename(repositoryPath) || "Projeto", NAME_MAX);
    if (existing) {
      this.db
        .prepare("UPDATE qa_projects SET name = ?, updated_at = ? WHERE id = ?")
        .run(name, now, existing.id);
      if (!this.setting("active_project_id")) this.setSetting("active_project_id", existing.id);
      this.ensureDefaultEnvironment(existing.id, config);
      return this.workspace();
    }
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO qa_projects (id, name, description, type, repository_path, enabled, created_at, updated_at)
         VALUES (?, ?, '', 'mobile', ?, 1, ?, ?)`,
      )
      .run(id, name, repositoryPath, now, now);
    this.ensureDefaultEnvironment(id, config);
    if (!this.setting("active_project_id")) this.setSetting("active_project_id", id);
    this.maybeAttachLegacyRuns(id);
    return this.workspace();
  }

  private ensureDefaultEnvironment(
    projectId: string,
    config: Pick<AppConfig, "apiUrl" | "apiLabel" | "environmentLabel">,
  ): void {
    const current = this.listEnvironments(projectId);
    if (current.length > 0) return;
    const now = new Date().toISOString();
    const label = cleanText(config.environmentLabel, "dev", 40);
    this.db
      .prepare(
        `INSERT INTO qa_environments (id, project_id, name, label, api_url, api_label, production, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      )
      .run(randomUUID(), projectId, label, label, config.apiUrl, cleanText(config.apiLabel, "API", 40), now);
  }

  private maybeAttachLegacyRuns(projectId: string): void {
    const projects = this.listProjects();
    if (projects.length !== 1) return;
    try {
      this.db.prepare("UPDATE runs SET project_id = ? WHERE project_id IS NULL").run(projectId);
    } catch {
      /* runs may not exist */
    }
  }

  createProject(input: {
    name?: unknown;
    description?: unknown;
    type?: unknown;
    repositoryPath?: unknown;
  }): QaProject {
    if (typeof input.repositoryPath !== "string") {
      throw new RequestError(400, "Informe um diretório local absoluto e autorizado.");
    }
    const repositoryPath = assertAuthorizedRepoPath(input.repositoryPath);
    if (this.findByPath(repositoryPath)) {
      throw new RequestError(409, "Este diretório já está cadastrado.");
    }
    const type = typeof input.type === "string" && TYPES.has(input.type as ProjectType) ? (input.type as ProjectType) : "mobile";
    const profile = resolveProject(repositoryPath);
    const name = cleanText(input.name, profile.name || path.basename(repositoryPath) || "Projeto", NAME_MAX);
    const description = cleanText(input.description, "", DESC_MAX);
    const now = new Date().toISOString();
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO qa_projects (id, name, description, type, repository_path, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      )
      .run(id, name, description, type, repositoryPath, now, now);
    this.ensureDefaultEnvironment(id, {
      apiUrl: profile.apiUrl,
      apiLabel: profile.apiLabel,
      environmentLabel: profile.environmentLabel,
    });
    const created = this.getProject(id);
    if (!created) throw new RequestError(500, "Falha interna do dashboard.");
    if (this.listProjects().length === 1) this.setSetting("active_project_id", id);
    return created;
  }

  updateProject(
    id: string,
    input: { name?: unknown; description?: unknown; type?: unknown; enabled?: unknown },
  ): QaProject {
    const current = this.getProject(id);
    if (!current) throw new RequestError(404, "Projeto não encontrado.");
    const name = input.name === undefined ? current.name : cleanText(input.name, current.name, NAME_MAX);
    const description = input.description === undefined ? current.description : cleanText(input.description, "", DESC_MAX);
    const type =
      typeof input.type === "string" && TYPES.has(input.type as ProjectType) ? (input.type as ProjectType) : current.type;
    const enabled = typeof input.enabled === "boolean" ? (input.enabled ? 1 : 0) : current.enabled ? 1 : 0;
    const now = new Date().toISOString();
    this.db
      .prepare("UPDATE qa_projects SET name = ?, description = ?, type = ?, enabled = ?, updated_at = ? WHERE id = ?")
      .run(name, description, type, enabled, now, id);
    const updated = this.getProject(id);
    if (!updated) throw new RequestError(404, "Projeto não encontrado.");
    return updated;
  }

  select(projectId: string, environmentId?: string | null): WorkspaceState {
    const project = this.getProject(projectId);
    if (!project || !project.enabled) throw new RequestError(404, "Projeto não encontrado.");
    this.setSetting("active_project_id", project.id);
    const environments = this.listEnvironments(project.id);
    const selected =
      (environmentId ? environments.find((item) => item.id === environmentId) : null) ?? environments[0] ?? null;
    if (selected) this.setSetting("active_environment_id", selected.id);
    else this.setSetting("active_environment_id", "");
    return this.workspace();
  }

  discover(projectId: string): ProjectDiscovery {
    const project = this.getProject(projectId);
    if (!project) throw new RequestError(404, "Projeto não encontrado.");
    const profile = resolveProject(project.repositoryPath);
    const catalog = readCatalog(project.repositoryPath);
    return {
      driver: profile.driver,
      appId: profile.appId,
      suites: profile.suites.map((suite) => ({ id: suite.id, label: suite.label, kind: suite.kind })),
      modules: catalog.modules.map((module) => ({ id: module.id, label: module.label, flowCount: module.flows.length })),
      flowCount: catalog.modules.reduce((sum, module) => sum + module.flows.length, 0),
      error: catalog.error,
    };
  }

  upsertEnvironment(projectId: string, input: { name?: unknown; label?: unknown; apiUrl?: unknown; apiLabel?: unknown; production?: unknown }): QaEnvironment {
    const project = this.getProject(projectId);
    if (!project) throw new RequestError(404, "Projeto não encontrado.");
    const label = cleanText(input.label ?? input.name, "dev", 40);
    const name = cleanText(input.name, label, 40);
    const production = input.production === true;
    const now = new Date().toISOString();
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO qa_environments (id, project_id, name, label, api_url, api_label, production, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        projectId,
        name,
        label,
        typeof input.apiUrl === "string" ? safeApiUrl(input.apiUrl, null) : null,
        cleanText(input.apiLabel, "API", 40),
        production ? 1 : 0,
        now,
      );
    const created = this.getEnvironment(id);
    if (!created) throw new RequestError(500, "Falha interna do dashboard.");
    return created;
  }
}
