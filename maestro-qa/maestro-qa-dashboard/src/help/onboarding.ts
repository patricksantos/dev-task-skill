import type { CatalogReport, PrerequisiteReport, RunView } from "@/types";
import type { WorkspaceState } from "@/projects/types";
import type { OnboardingStep } from "@/help/types";

export function onboardingSteps(input: {
  workspace: WorkspaceState | null;
  prereq: PrerequisiteReport | null;
  catalog: CatalogReport | null;
  history: RunView[] | null;
}): OnboardingStep[] {
  const project = Boolean(input.workspace?.activeProject);
  const environment = Boolean(input.workspace?.activeEnvironment);
  const target = Boolean(input.prereq?.checks?.some((check) => check.id === "simulator" && check.ok));
  const suites = (input.catalog?.suites?.length ?? 0) > 0;
  const run = (input.history ?? []).some((item) => item.mode === "script" && item.status !== "running");
  return [
    {
      id: "project",
      title: "Projeto",
      detail: project ? `${input.workspace?.activeProject?.name} está ativo.` : "Cadastre um diretório local com fluxos Maestro.",
      done: project,
      page: "projects",
      article: "primeiro-projeto",
      action: project ? "Abrir projetos" : "Cadastrar projeto",
    },
    {
      id: "environment",
      title: "Ambiente",
      detail: environment
        ? `${input.workspace?.activeEnvironment?.label} selecionado. Rótulos vêm do cadastro; o processo ainda define o alvo efetivo.`
        : "Selecione o ambiente do projeto ativo.",
      done: environment,
      page: "settings",
      article: "ambientes",
      action: "Ver ambiente",
    },
    {
      id: "target",
      title: "Alvo",
      detail: target
        ? `${input.prereq?.simulatorName ?? "Dispositivo"} está disponível.`
        : "Ligue um simulador iOS, um emulador/dispositivo Android ou o Chromium, conforme o tipo do projeto.",
      done: target,
      page: "settings",
      article: "instalacao",
      action: "Ver pré-requisitos",
    },
    {
      id: "suites",
      title: "Testes",
      detail: suites
        ? `${input.catalog?.suites?.length} suíte(s) autorizada(s) no catálogo.`
        : "O repositório precisa de pastas em .maestro/flows ou dos scripts run_maestro_*.sh conhecidos.",
      done: suites,
      page: "executions",
      article: "suites-autorizadas",
      action: "Ver catálogo",
    },
    {
      id: "run",
      title: "Primeira execução",
      detail: run
        ? "Já existe ao menos uma execução real concluída neste projeto."
        : "Dispare uma suíte em modo real a partir de Execuções. O onboarding não inicia testes sozinho.",
      done: run,
      page: "executions",
      article: "executar-testes",
      action: run ? "Abrir execuções" : "Ir para Execuções",
    },
  ];
}

export function onboardingProgress(steps: OnboardingStep[]): { done: number; total: number; complete: boolean } {
  const done = steps.filter((step) => step.done).length;
  return { done, total: steps.length, complete: done === steps.length };
}
