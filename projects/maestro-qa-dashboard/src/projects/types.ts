export type ProjectType = "mobile" | "web" | "hybrid";

export interface QaProject {
  id: string;
  name: string;
  description: string;
  type: ProjectType;
  repositoryPath: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface QaEnvironment {
  id: string;
  projectId: string;
  name: string;
  label: string;
  apiUrl: string | null;
  apiLabel: string;
  production: boolean;
  createdAt: string;
}

export interface WorkspaceState {
  projects: QaProject[];
  environments: QaEnvironment[];
  activeProjectId: string | null;
  activeEnvironmentId: string | null;
  activeProject: QaProject | null;
  activeEnvironment: QaEnvironment | null;
}

export interface ProjectDiscovery {
  driver: "scripts" | "flows";
  appId: string;
  suites: Array<{ id: string; label: string; kind: "script" | "maestro" }>;
  modules: Array<{ id: string; label: string; flowCount: number }>;
  flowCount: number;
  error: string | null;
}
