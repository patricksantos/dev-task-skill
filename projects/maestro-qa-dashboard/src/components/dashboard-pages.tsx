import { useState, type ReactNode, type RefObject } from "react";
import type { CatalogReport, LogStream, LogView, PrerequisiteReport, RunView, ScenarioView, SuiteId } from "@/types";
import type { ProjectDiscovery, QaProject, WorkspaceState } from "@/projects/types";
import { STATUS_LABEL, formatDuration, formatPercent, formatWhen } from "@/components/format";
import { CatalogMark, CommandList, LogLine, ScenarioButton } from "@/components/panels";
import { ReadField, SelectField, TextField } from "@/components/fields";
import { DocLink, HelpCenter, OnboardingStrip, TextLink } from "@/components/help-center";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle, useTheme } from "@/components/theme-toggle";
import { applyTheme, type Theme } from "@/theme/theme";
import {
  DevicePreview,
  ExecutionHistoryTable,
  ExecutionProgress,
  PageTitle,
  TestRunStatus,
  TestRunTimeline,
  TestSuiteSelector,
} from "@/components/ui";
import {
  classifyFlow,
  confirmationNote,
  detailFailure,
  isLiveScenario,
  moduleLabel,
  scenarioDuration,
  scenarioKey,
  type BoardIndicators,
  type HistorySummary,
  type TimelineStep,
} from "@/components/view-model";
import type { CommandStep } from "@/components/view-model";
import {
  IconAlert,
  IconCheck,
  IconCli,
  IconClock,
  IconCross,
  IconDevice,
  IconFlask,
  IconHelp,
  IconHistory,
  IconLink,
  IconOverview,
  IconProjects,
  IconRuns,
  IconScripts,
  IconSearch,
  IconSettings,
  IconShield,
} from "@/components/icons";

type PageId = "overview" | "executions" | "history" | "projects" | "settings" | "details" | "help";

const PAGES: Array<{ id: Exclude<PageId, "details">; label: string; icon: typeof IconOverview }> = [
  { id: "overview", label: "Visão geral", icon: IconOverview },
  { id: "executions", label: "Runs", icon: IconRuns },
  { id: "history", label: "Histórico", icon: IconHistory },
  { id: "projects", label: "Projetos", icon: IconProjects },
  { id: "settings", label: "Settings", icon: IconSettings },
  { id: "help", label: "Documentação", icon: IconHelp },
];

const NAV_GROUPS: Array<{ label: string; ids: Array<Exclude<PageId, "details">> }> = [
  { label: "Operação", ids: ["overview", "executions", "history"] },
  { label: "Conta", ids: ["projects"] },
  { label: "Sistema", ids: ["settings", "help"] },
];

const PROJECT_TYPE_LABEL = { mobile: "Mobile", web: "Web", hybrid: "Híbrido" } as const;

export function DashboardPages(props: {
  page: PageId;
  setPage: (page: PageId) => void;
  prereq: PrerequisiteReport | null;
  prereqError: string | null;
  catalog: CatalogReport | null;
  run: RunView | null;
  scenarios: ScenarioView[];
  logs: LogView[];
  history: RunView[] | null;
  historyRows: RunView[];
  historyFilter: "all" | "real" | "demo";
  setHistoryFilter: (value: "all" | "real" | "demo") => void;
  error: string | null;
  liveNotice: string | null;
  pending: boolean;
  stream: LogStream | "all";
  setStream: (value: LogStream | "all") => void;
  query: string;
  setQuery: (value: string) => void;
  autoScroll: boolean;
  setAutoScroll: (value: boolean) => void;
  moduleFilter: string;
  setModuleFilter: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: "all" | "pending" | "running" | "passed" | "failed" | "skipped" | "aborted") => void;
  focusKey: string | null;
  setFocusKey: (value: string | null | ((current: string | null) => string | null)) => void;
  demoSuite: SuiteId;
  setDemoSuite: (value: SuiteId) => void;
  preview: string | null;
  previewAt: string | null;
  previewError: string | null;
  autoCapture: boolean;
  setAutoCapture: (value: boolean) => void;
  enlarge: boolean;
  setEnlarge: (value: boolean) => void;
  inspection: { run: RunView; scenarios: ScenarioView[]; logs: LogView[] } | null;
  setInspection: (value: null) => void;
  stepKey: string | null;
  setStepKey: (value: string | null) => void;
  now: number;
  logEnd: RefObject<HTMLDivElement | null>;
  logSection: RefObject<HTMLElement | null>;
  running: boolean;
  blocked: boolean;
  selected: ScenarioView | null;
  steps: CommandStep[];
  visibleLogs: LogView[];
  progress: { confirmed: number; total: number; currentName: string | null; currentCommand: string | null };
  elapsed: number | null;
  runner: { label: string; tone: string };
  summary: { label: string; tone: string };
  connection: { label: string; tone: string };
  modules: string[];
  visibleScenarios: ScenarioView[];
  indicators: BoardIndicators;
  overview: HistorySummary;
  failures: Array<{ name: string; count: number }> | null;
  liveTimeline: TimelineStep[];
  pastTimeline: TimelineStep[];
  deviceName: string;
  showScenarioLogs: (scenario: ScenarioView) => void;
  start: (suite: SuiteId, mode: "script" | "fixture") => void;
  stop: () => void;
  openRun: (id: string) => void;
  capture: () => void;
  workspace: WorkspaceState | null;
  discovery: ProjectDiscovery | null;
  selectProject: (projectId: string, environmentId?: string | null) => void;
  createProject: (input: { name: string; description: string; type: "mobile" | "web" | "hybrid"; repositoryPath: string }) => void;
  confirm: { suite: SuiteId; mode: "script" | "fixture" } | null;
  setConfirm: (value: { suite: SuiteId; mode: "script" | "fixture" } | null) => void;
  scenarioQuery: string;
  setScenarioQuery: (value: string) => void;
  scenarioPage: number;
  setScenarioPage: (value: number) => void;
  historySuite: string;
  setHistorySuite: (value: string) => void;
  historyResult: string;
  setHistoryResult: (value: string) => void;
  historyQuery: string;
  setHistoryQuery: (value: string) => void;
  historyPage: number;
  setHistoryPage: (value: number) => void;
  helpTopic: string;
  setHelpTopic: (value: string) => void;
}) {
  function openHelp(slug: string) {
    props.setHelpTopic(slug);
    props.setPage("help");
  }
  const historical = props.page === "details" && props.inspection != null;
  const detailRun = historical ? props.inspection?.run ?? null : props.run;
  const detailScenarios = historical ? props.inspection?.scenarios ?? [] : props.scenarios;
  const detailLogs = historical
    ? (props.inspection?.logs ?? []).filter((entry) => entry.runId === props.inspection?.run.id)
    : props.logs;
  const detailTimeline = historical ? props.pastTimeline : props.liveTimeline;
  const selectedStep = detailTimeline.find((step) => step.key === props.stepKey) ?? null;

  const projects = props.workspace?.projects ?? [];
  const environments = props.workspace?.environments ?? [];

  if (props.page === "help") {
    return (
      <HelpCenter
        topic={props.helpTopic}
        setTopic={props.setHelpTopic}
        workspace={props.workspace}
        prereq={props.prereq}
        catalog={props.catalog}
        history={props.history}
        onPage={props.setPage}
      />
    );
  }

  return (
    <div className="shell">
      <aside className="nav">
        <div className="brand brand-mark">
          <BrandLogo />
          <span>Execução e validação E2E</span>
        </div>
        <nav className="nav-list" aria-label="Seções">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="nav-group">
              <span className="nav-group-label">{group.label}</span>
              {group.ids.map((id) => {
                const item = PAGES.find((page) => page.id === id);
                if (!item) return null;
                return (
                  <button key={item.id} type="button" aria-current={props.page === item.id ? "page" : undefined} onClick={() => props.setPage(item.id)}>
                    <item.icon />
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="nav-workspace">
          <small>Workspace</small>
          <b>{props.workspace?.activeProject?.name ?? "Todos os projetos"}</b>
          <ThemeToggle labeled />
        </div>
      </aside>
      <div className="workspace">
      <header className="topbar">
        <div className="switcher">
          <span>Projeto</span>
          <SelectField
            ariaLabel="Projeto ativo"
            value={props.workspace?.activeProjectId ?? ""}
            onChange={(value) => props.selectProject(value)}
            options={projects.length === 0 ? [{ value: "", label: "Nenhum projeto cadastrado" }] : projects.map((project) => ({ value: project.id, label: project.name }))}
          />
        </div>
        <div className="switcher">
          <span>Ambiente</span>
          <SelectField
            ariaLabel="Ambiente ativo"
            value={props.workspace?.activeEnvironmentId ?? ""}
            disabled={!props.workspace?.activeProjectId}
            onChange={(value) => props.workspace?.activeProjectId && props.selectProject(props.workspace.activeProjectId, value)}
            options={environments.length === 0 ? [{ value: "", label: "Sem ambiente" }] : environments.map((environment) => ({ value: environment.id, label: `${environment.label}${environment.production ? " (produção)" : ""}` }))}
          />
        </div>
        <DocLink slug="ambientes" onOpen={openHelp}>Como escolher o ambiente</DocLink>
      </header>
      <main className="canvas">
        {props.liveNotice ? <p className="alert">{props.liveNotice}</p> : null}
        {props.error ? <p className="alert">{props.error}</p> : null}
        {props.page === "overview" ? <Overview {...props} openHelp={openHelp} /> : null}
        {props.page === "executions" ? <Executions {...props} openHelp={openHelp} /> : null}
        {props.page === "history" ? <History {...props} openHelp={openHelp} /> : null}
        {props.page === "projects" ? <Projects {...props} openHelp={openHelp} /> : null}
        {props.page === "settings" ? <Settings {...props} openHelp={openHelp} /> : null}
        {props.page === "details" ? (
          <DetailsPage
            run={detailRun}
            scenarios={detailScenarios}
            logs={detailLogs}
            timeline={detailTimeline}
            selectedStep={selectedStep}
            historical={historical}
            deviceName={props.deviceName}
            udid={props.prereq?.simulatorUdid ?? null}
            connection={props.connection}
            preview={historical ? null : props.preview}
            previewAt={historical ? null : props.previewAt}
            running={props.running}
            autoCapture={props.autoCapture}
            previewError={historical ? null : props.previewError}
            onBack={() => props.setPage(historical ? "history" : "executions")}
            onSelect={(step) => {
              props.setStepKey(step.key);
              if (!historical && props.run) {
                const scenario = props.scenarios.find((item) => item.name === step.scenarioName);
                if (scenario) props.setFocusKey(scenarioKey(props.run.id, scenario));
              }
            }}
            onCapture={() => void props.capture()}
            onEnlarge={() => props.preview && props.setEnlarge(true)}
            onAuto={props.setAutoCapture}
          />
        ) : null}
        {props.enlarge && props.preview ? (
          <div className="overlay" role="dialog" aria-label="Captura ampliada do simulador">
            <div className="sheet wide">
              <img className="enlarged" src={props.preview} alt="Captura ampliada do simulador" />
              <div className="row end">
                <span className="muted">{formatWhen(props.previewAt)}</span>
                <button className="text" type="button" onClick={() => props.setEnlarge(false)}>Fechar</button>
              </div>
            </div>
          </div>
        ) : null}
        {props.confirm ? (
          <div className="dialog-backdrop" role="dialog" aria-labelledby="confirm-run-title">
            <div className="dialog">
              <h2 id="confirm-run-title">Confirmar execução</h2>
              <p>Projeto: <b>{props.workspace?.activeProject?.name ?? props.prereq?.projectName ?? "Projeto"}</b></p>
              <p>Ambiente: <b>{props.prereq?.environment ?? "dev"}</b></p>
              <p>Alvo: <b>{props.deviceName}</b></p>
              <p>Suíte: <b>{props.catalog?.suites?.find((item) => item.id === props.confirm?.suite)?.label ?? props.confirm?.suite}</b></p>
              <p className="muted">{props.confirm?.mode === "fixture" ? "Demonstração: nenhum teste será enviado ao dispositivo." : "A execução usa apenas suítes autorizadas do projeto ativo."}</p>
              {!props.prereq?.ready && props.confirm?.mode === "script" ? <p className="alert">Há pré-requisitos obrigatórios indisponíveis.</p> : null}
              <div className="row end">
                <button className="text" type="button" onClick={() => props.setConfirm(null)}>Cancelar</button>
                <button className="action" type="button" onClick={() => { const next = props.confirm; props.setConfirm(null); if (next) props.start(next.suite, next.mode); }}>Executar</button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
      </div>
    </div>
  );
}

type PageProps = Parameters<typeof DashboardPages>[0] & { openHelp: (slug: string) => void };

function Overview(props: PageProps) {
  const summary = props.overview;
  const last = summary.last;
  const failedRuns = (props.history ?? []).filter((item) => item.mode === "script" && item.failedCount > 0).length;
  const checkIcon = (id: string) => {
    if (id === "maestro") return <IconCli />;
    if (id === "simulator") return <IconDevice />;
    if (id === "scripts") return <IconScripts />;
    return <IconLink />;
  };
  return (
    <>
      <PageTitle title="Visão geral" detail="Projeto, prontidão do ambiente e resultados das execuções reais.">
        <DocLink slug="introducao" onOpen={props.openHelp}>O que é o Maestro QA</DocLink>
      </PageTitle>
      <OnboardingStrip
        workspace={props.workspace}
        prereq={props.prereq}
        catalog={props.catalog}
        history={props.history}
        onPage={props.setPage}
        onArticle={props.openHelp}
      />
      <section className="context-strip" aria-label="Contexto do projeto">
        <article className="context-card"><span className="context-ico"><IconScripts /></span><div className="context-copy"><small>Projeto</small><b>{props.workspace?.activeProject?.name ?? props.prereq?.projectName ?? "Nenhum projeto"}</b><span className="meta">{props.workspace?.activeProject?.description || props.workspace?.activeProject?.type || "—"}</span></div></article>
        <article className="context-card"><span className="context-ico"><IconLink /></span><div className="context-copy"><small>Ambiente</small><b>{props.prereq?.environment ?? "dev"}</b><span className="meta">{props.prereq?.apiLabel ?? "API"}</span></div></article>
        <article className="context-card"><span className="context-ico"><IconDevice /></span><div className="context-copy"><small>Dispositivo</small><b>{props.deviceName}</b></div></article>
        <article className="context-card"><span className="context-ico"><IconRuns /></span><div className="context-copy"><small>Runner</small><b className={`tone tone-${props.runner.tone}`}>{props.runner.label}</b></div></article>
      </section>
      <section className="card ready">
        <div className="ready-head">
          <div>
            <h2><IconShield /> Prontidão para execução</h2>
            <p className="muted">Confira se o ambiente está pronto para rodar os testes.</p>
          </div>
          <span className={`ready-pill tone-${props.summary.tone}`}>{props.summary.label === "Prontos" ? "Tudo pronto para executar" : props.summary.label}</span>
        </div>
        {props.prereqError ? <p className="alert">{props.prereqError}</p> : null}
        <div className="ready-grid">
          {(props.prereq?.checks ?? []).map((check) => (
            <article key={check.id} className={`ready-item ${check.ok ? "ok" : check.level === "warning" ? "warn" : "bad"}`}>
              <div className="ready-item-head">{checkIcon(check.id)}{check.ok ? <IconCheck className="ready-check" /> : <IconCross className="ready-check" />}</div>
              <b>{check.label}</b>
              <span className="meta">{check.message}</span>
            </article>
          ))}
        </div>
      </section>
      {props.history == null ? <p className="muted">Carregando histórico.</p> : null}
      {props.history != null && summary.basis === "empty" ? (
        <section className="card empty-state">
          <h2>Nenhuma execução real</h2>
          <p>Ainda não há uma suíte concluída neste projeto. Demonstrações ficam no Histórico e não entram nestes números.</p>
        </section>
      ) : null}
      {summary.basis === "real" ? (
        <section className="kpi-row" aria-label="Resultado das execuções reais">
          <article className="kpi"><small><IconFlask /> Total de testes</small><strong>{summary.tests}</strong><span className="meta">Executados</span></article>
          <article className="kpi"><small><IconCheck /> Aprovados</small><strong className="tone-ok">{summary.passed}</strong></article>
          <article className="kpi"><small><IconCross /> Reprovados</small><strong className="tone-bad">{summary.failed}</strong></article>
          <article className="kpi"><small><IconCheck /> Taxa de sucesso</small><strong className="tone-ok">{summary.success}</strong></article>
          <article className="kpi"><small><IconClock /> Duração média</small><strong>{formatDuration(summary.averageMs)}</strong></article>
        </section>
      ) : null}
      {last ? (
        <section className={`last-run ${last.status === "passed" ? "ok" : ""}`}>
          <IconRuns />
          <div className="last-run-copy">
            <h2>Última execução real</h2>
            <p className="muted">{formatWhen(last.createdAt)} · {last.simulatorName ?? props.deviceName} · {last.suiteLabel} · {last.passedCount} aprovados · {last.failedCount} reprovados · {formatDuration(last.durationMs)}</p>
          </div>
          <TestRunStatus status={last.status} />
          <button className="text" type="button" onClick={() => props.openRun(last.id)}>Ver detalhes</button>
        </section>
      ) : null}
      {summary.last ? (
        <div className="split-2">
          <section className="card">
            <div className="card-head"><h2><IconHistory /> Execuções recentes</h2><TextLink onClick={() => props.setPage("history")}>Ver histórico completo</TextLink></div>
            <p className="muted">Últimas execuções reais deste projeto.</p>
            <div className="history compact">
              <table>
                <thead><tr><th>Data e hora</th><th>Tipo</th><th>Dispositivo</th><th>Resultado</th><th>Duração</th></tr></thead>
                <tbody>
                  {summary.latest.map((item) => (
                    <tr key={item.id}>
                      <td><TextLink onClick={() => props.openRun(item.id)}>{formatWhen(item.createdAt)}</TextLink></td>
                      <td><span className="tag real">Real</span></td>
                      <td>{item.simulatorName ?? "—"}</td>
                      <td><TestRunStatus status={item.status} /></td>
                      <td>{formatDuration(item.durationMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="card">
            <div className="card-head"><h2><IconAlert /> Falhas recorrentes</h2><TextLink onClick={() => props.setPage("history")}>Ver todos os insights</TextLink></div>
            {props.failures == null ? <p className="muted">Carregando falhas das execuções reais.</p> : null}
            {props.failures?.length === 0 ? <p className="muted">Nenhum cenário real falhou mais de uma vez neste projeto.</p> : null}
            <div className="insight">
              {(props.failures ?? []).map((item) => (
                <div className="insight-row" key={item.name}>
                  <div>
                    <b>{item.name}</b>
                    <span className="meta">{item.count} reprovações em execuções reais comparáveis</span>
                  </div>
                  <span className="pct">{failedRuns > 0 ? formatPercent(item.count, Math.max(failedRuns, item.count)) : `${item.count}x`}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function Executions(props: PageProps) {
  const runKey = props.run?.id ?? "";
  const needle = props.scenarioQuery.trim().toLowerCase();
  const queried = props.visibleScenarios.filter((scenario) => !needle || `${scenario.name} ${scenario.module ?? ""}`.toLowerCase().includes(needle));
  const pageSize = 8;
  const pages = Math.max(1, Math.ceil(queried.length / pageSize));
  const page = Math.min(props.scenarioPage, pages);
  const sliced = queried.slice((page - 1) * pageSize, page * pageSize);
  return (
    <>
      <PageTitle title="Execuções" detail="Controle, execução e análise de cenários de teste do projeto selecionado.">
        <DocLink slug="executar-testes" onOpen={props.openHelp}>Como executar uma suíte</DocLink>
      </PageTitle>
      <section className="card run-toolbar">
        <div className="project-pill"><small>Projeto para executar</small><b>{props.workspace?.activeProject?.name ?? props.prereq?.projectName ?? "Projeto"}</b></div>
        <TestSuiteSelector
          suites={props.catalog?.suites ?? []}
          blocked={props.blocked || props.catalog == null}
          running={props.running}
          pending={props.pending}
          demoSuite={props.demoSuite}
          onDemo={props.setDemoSuite}
          onStart={(suite, mode) => props.setConfirm({ suite, mode })}
          onStop={props.stop}
        />
      </section>
      <div className="chip-row" role="tablist" aria-label="Módulos do projeto">
        <button className="chip" type="button" aria-pressed={props.moduleFilter === "all"} onClick={() => props.setModuleFilter("all")}>Todos ({props.scenarios.length || props.catalog?.modules?.reduce((sum, item) => sum + (item.flows?.length ?? 0), 0) || 0})</button>
        {(props.catalog?.modules ?? []).map((module) => (
          <button key={module.id} className="chip" type="button" aria-pressed={props.moduleFilter === module.id} onClick={() => props.setModuleFilter(module.id)}>
            {module.label} ({module.flows?.length ?? 0})
          </button>
        ))}
      </div>
      {props.catalog != null && (props.catalog.suites?.length ?? 0) === 0 ? <p className="muted">Nenhuma suíte encontrada. O repositório precisa de scripts Maestro ou de fluxos em .maestro/flows.</p> : null}
      {props.run?.mode === "fixture" ? <p className="demo-note">Demonstração com saída simulada. Nenhum teste foi enviado ao simulador.</p> : null}
      {props.run?.errorMessage ? <p className="alert">{props.run.errorMessage}</p> : null}
      {props.run ? (
        <section className={`run-banner ${props.run.status}`}>
          <div>
            <p className="run-id">Execução {props.run.id.slice(0, 8)}</p>
            <p className="muted">{formatWhen(props.run.createdAt)} · {props.run.simulatorName ?? props.deviceName} · {props.prereq?.environment ?? "dev"}</p>
          </div>
          <TestRunStatus status={props.run.status} provisional={props.run.status === "running"} />
          <button className="text" type="button" onClick={() => { props.setInspection(null); props.setPage("details"); }}>Ver histórico da suíte</button>
        </section>
      ) : null}
      <section className="kpi-row run-kpis" aria-label="Resumo da execução">
        <article className="kpi" data-testid="metric-total"><small>Total de cenários</small><strong>{props.indicators.total}</strong></article>
        <article className="kpi" data-testid="metric-passed"><small>Aprovados</small><strong className="tone-ok">{props.indicators.passed}</strong></article>
        <article className="kpi" data-testid="metric-failed"><small>Reprovados</small><strong className="tone-bad">{props.indicators.failed}</strong></article>
        <article className="kpi" data-testid="metric-success"><small>Sucesso</small><strong className="tone-ok">{props.indicators.success}</strong></article>
        <article className="kpi"><small>Duração</small><strong>{formatDuration(props.elapsed)}</strong></article>
      </section>
      {props.run ? (
        <ExecutionProgress
          confirmed={props.progress.confirmed}
          total={props.progress.total}
          current={props.progress.currentName}
          command={props.progress.currentCommand}
          elapsed={formatDuration(props.elapsed)}
          state={props.scenarios.length === 0 && props.run.status !== "running" ? "Sem testes" : STATUS_LABEL[props.run.status]}
          demo={props.run.mode === "fixture"}
          pending={props.indicators.pending}
          skipped={props.indicators.skipped}
        />
      ) : null}
      <div className="exec-grid">
        <div>
          <section className="card">
            <div className="card-head">
              <h2>Cenário ({queried.length})</h2>
              <div className="filters">
                <div className="search-field">
                  <IconSearch />
                  <TextField value={props.scenarioQuery} onChange={(value) => { props.setScenarioQuery(value); props.setScenarioPage(1); }} placeholder="Buscar cenário por nome, módulo ou comando" ariaLabel="Buscar cenário" />
                </div>
                <SelectField
                  label="Status"
                  value={props.statusFilter}
                  onChange={(value) => props.setStatusFilter(value as "all" | "pending" | "running" | "passed" | "failed" | "skipped" | "aborted")}
                  options={["all", "pending", "running", "passed", "failed", "skipped", "aborted"].map((status) => ({
                    value: status,
                    label: status === "all" ? "Todos" : STATUS_LABEL[status as keyof typeof STATUS_LABEL],
                  }))}
                />
              </div>
            </div>
            {props.run && props.scenarios.length === 0 ? <p className="muted">Suíte sem testes. Nenhum cenário foi executado.</p> : null}
            {!props.run && props.scenarios.length === 0 ? <p className="muted">Nenhuma execução em foco. Escolha uma suíte ou abra uma demonstração.</p> : null}
            {props.scenarios.length > 0 && queried.length === 0 ? <p className="muted">Nenhum cenário neste filtro.</p> : null}
            <div className="scenario-table" role="table">
              <div className="scenario-head" role="row">
                <span>Cenário</span><span>Módulo</span><span>Status</span><span>Duração</span><span>Último comando</span>
              </div>
              <div className="scenario-list">
                {sliced.map((scenario) => {
                  const key = scenarioKey(runKey, scenario);
                  return (
                    <ScenarioButton
                      key={key}
                      scenario={scenario}
                      selected={props.focusKey === key}
                      live={isLiveScenario(props.scenarios, scenario)}
                      now={props.now}
                      onSelect={() => props.setFocusKey((current) => current === key ? null : key)}
                    />
                  );
                })}
              </div>
            </div>
            {queried.length > pageSize ? (
              <div className="pager">
                <span>Exibindo {(page - 1) * pageSize + 1}–{(page - 1) * pageSize + sliced.length} de {queried.length}</span>
                <div className="pager-btns">
                  <button className="text" type="button" disabled={page <= 1} onClick={() => props.setScenarioPage(page - 1)}>Anterior</button>
                  <button className="text" type="button" disabled={page >= pages} onClick={() => props.setScenarioPage(page + 1)}>Próxima</button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
        <div className="exec-side">
        <DevicePreview
          name={props.deviceName}
          udid={props.prereq?.simulatorUdid ?? null}
          connection={props.connection}
          preview={props.preview}
          previewAt={props.previewAt}
              empty="A tela do simulador aparece aqui depois de uma captura. Não há vídeo ao vivo."
          running={props.running}
          autoCapture={props.autoCapture}
          error={props.previewError}
          kind={props.workspace?.activeProject?.type === "web" ? "web" : "mobile"}
          onCapture={() => void props.capture()}
          onEnlarge={() => props.preview && props.setEnlarge(true)}
          onAuto={props.setAutoCapture}
        />
          <section className="card" data-testid="scenario-detail">
            <div className="card-head">
              <h2>Detalhes do comando selecionado</h2>
              {props.selected ? <TestRunStatus status={props.selected.status} provisional={!props.selected.confirmed && props.selected.status === "running"} /> : null}
            </div>
            {props.selected ? (
              <>
                <dl className="detail-dl">
                  <div><dt>Cenário</dt><dd>{props.selected.name}</dd></div>
                  <div><dt>Módulo</dt><dd>{moduleLabel(props.selected.module)}</dd></div>
                  <div><dt>Comando</dt><dd className="mono">{props.selected.command ?? props.steps.at(-1)?.text ?? "—"}</dd></div>
                </dl>
                <FailureText text={detailFailure(props.selected)} />
                {confirmationNote(props.selected) ? <p className="muted">{confirmationNote(props.selected)}</p> : null}
                <CommandList steps={props.steps} />
              </>
            ) : <p className="muted">Selecione um cenário para ver os comandos e a falha completa.</p>}
          </section>
          <section className="card" ref={props.logSection}>
            <div className="card-head">
              <h2>Log de execução (sanitized)</h2>
              <div className="filters">
                {(["all", "stdout", "stderr"] as const).map((item) => (
                  <button key={item} className="text" type="button" aria-pressed={props.stream === item} onClick={() => props.setStream(item)}>
                    {item === "all" ? "Tudo" : item}
                  </button>
                ))}
                <TextField value={props.query} onChange={props.setQuery} placeholder="Buscar no log" ariaLabel="Buscar nos logs" />
              </div>
            </div>
            <div className="logs" data-testid="log-panel">
              {props.visibleLogs.map((entry) => <LogLine key={entry.id} entry={entry} />)}
              {props.visibleLogs.length === 0 ? <p className="muted">Sem linhas para o filtro atual.</p> : null}
              <div ref={props.logEnd} />
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function History(props: PageProps) {
  const summary = props.overview;
  const needle = props.historyQuery.trim().toLowerCase();
  const filtered = props.historyRows.filter((item) => {
    if (props.historySuite !== "all" && item.suite !== props.historySuite) return false;
    if (props.historyResult !== "all" && item.status !== props.historyResult) return false;
    if (needle && !`${item.suiteLabel} ${item.simulatorName ?? ""} ${item.id}`.toLowerCase().includes(needle)) return false;
    return true;
  });
  const pageSize = 8;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(props.historyPage, pages);
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const suites = [...new Map((props.history ?? []).map((item) => [item.suite, item.suiteLabel])).entries()];
  function exportCsv() {
    const header = ["data", "projeto", "suite", "ambiente", "dispositivo", "duracao_ms", "aprovados", "reprovados", "resultado", "modo"];
    const lines = filtered.map((item) =>
      [item.createdAt, props.workspace?.activeProject?.name ?? props.prereq?.projectName ?? "", item.suiteLabel, item.environment, item.simulatorName ?? "", String(item.durationMs ?? ""), String(item.passedCount), String(item.failedCount), item.status, item.mode]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "maestro-qa-historico.csv";
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <PageTitle title="Histórico" detail="Cada linha representa uma execução concluída de testes, com seus resultados e detalhes.">
        <DocLink slug="historico" onOpen={props.openHelp}>Como ler o histórico</DocLink>
      </PageTitle>
      <div className="filter-bar">
        <SelectField
          label="Tipo"
          value={props.historyFilter}
          onChange={(value) => props.setHistoryFilter(value as "all" | "real" | "demo")}
          options={[
            { value: "all", label: "Todos os tipos" },
            { value: "real", label: "Real" },
            { value: "demo", label: "Demonstração" },
          ]}
        />
        <SelectField
          label="Suíte"
          value={props.historySuite}
          onChange={(value) => { props.setHistorySuite(value); props.setHistoryPage(1); }}
          options={[{ value: "all", label: "Todas" }, ...suites.filter(([id]) => id !== "all").map(([id, label]) => ({ value: id, label }))]}
        />
        <SelectField
          label="Resultado"
          value={props.historyResult}
          onChange={(value) => { props.setHistoryResult(value); props.setHistoryPage(1); }}
          options={[
            { value: "all", label: "Todos" },
            { value: "passed", label: "Aprovado" },
            { value: "failed", label: "Reprovado" },
            { value: "aborted", label: "Interrompido" },
          ]}
        />
        <TextField
          label="Busca"
          value={props.historyQuery}
          onChange={(value) => { props.setHistoryQuery(value); props.setHistoryPage(1); }}
          placeholder="Buscar por suíte, dispositivo ou ID"
        />
      </div>
      <section className="kpi-row" aria-label="Indicadores históricos">
        <article className="kpi"><small><IconFlask /> Total de execuções</small><strong>{summary.runs}</strong><span className="meta">Execuções reais concluídas</span></article>
        <article className="kpi"><small><IconCheck /> Taxa de sucesso</small><strong className="tone-ok">{summary.success}</strong></article>
        <article className="kpi"><small><IconClock /> Duração média</small><strong>{formatDuration(summary.averageMs)}</strong></article>
        <article className="kpi"><small><IconAlert /> Reprovações recorrentes</small><strong className="tone-bad">{props.failures?.length ?? 0}</strong></article>
      </section>
      <div className="split-2">
        <section className="card">
          <div className="card-head"><h2>Falhas mais frequentes</h2></div>
          {props.failures == null ? <p className="muted">Carregando.</p> : null}
          {props.failures?.length === 0 ? <p className="muted">Sem falhas recorrentes o suficiente para classificar.</p> : null}
          <div className="insight">
            {(props.failures ?? []).map((item, index) => (
              <div className="insight-row" key={item.name}>
                <span className="rank">{index + 1}</span>
                <div>
                  <b>{item.name}</b>
                  <span className="meta">Falhou em {item.count} execuções reais comparáveis</span>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="card">
          <div className="card-head"><h2>Módulos do catálogo</h2></div>
          {(props.catalog?.modules ?? []).length === 0 ? <p className="muted">Nenhum módulo neste projeto.</p> : null}
          <div className="insight">
            {(props.catalog?.modules ?? []).map((module) => {
              const total = Math.max(1, (props.catalog?.modules ?? []).reduce((sum, item) => sum + (item.flows?.length ?? 0), 0));
              const share = Math.round(((module.flows?.length ?? 0) / total) * 1000) / 10;
              return (
                <div className="insight-row" key={module.id}>
                  <div className="bar-label"><b>{module.label}</b><span className="meta">{module.flows?.length ?? 0} fluxos</span></div>
                  <div className="bar"><i style={{ width: `${share}%` }} /></div>
                  <span className="pct">{share}%</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      <section className="card" data-testid="history">
        <div className="card-head">
          <h2>Execuções ({filtered.length})</h2>
          <button className="text" type="button" onClick={exportCsv} disabled={filtered.length === 0}>Exportar CSV</button>
        </div>
          <ExecutionHistoryTable
            projectName={props.workspace?.activeProject?.name ?? props.prereq?.projectName ?? "Projeto"}
            rows={rows}
            loading={props.history == null}
            empty={props.historyFilter === "real" ? "Nenhuma execução real neste histórico." : "Nenhuma execução neste filtro."}
            onOpen={props.openRun}
          />
          {filtered.length > pageSize ? (
            <div className="pager">
              <span>Página {page} de {pages}</span>
              <div className="pager-btns">
                <button className="text" type="button" disabled={page <= 1} onClick={() => props.setHistoryPage(page - 1)}>Anterior</button>
                <button className="text" type="button" disabled={page >= pages} onClick={() => props.setHistoryPage(page + 1)}>Próxima</button>
              </div>
            </div>
          ) : null}
      </section>
    </>
  );
}

function Settings(props: PageProps) {
  const theme = useTheme();
  const project = props.workspace?.activeProject;
  const isWeb = project?.type === "web";
  const maestro = props.prereq?.checks?.find((check) => check.id === "maestro");
  const device = props.prereq?.checks?.find((check) => check.id === "simulator");
  const scripts = props.prereq?.checks?.find((check) => check.id === "scripts");
  const api = props.prereq?.checks?.find((check) => check.id === "hml");
  return (
    <>
      <PageTitle title="Configurações" detail="Aparência, ambiente efetivo, fluxos autorizados e integrações do projeto ativo.">
        <button className="text" type="button" onClick={() => props.setPage("projects")}>Abrir projetos</button>
      </PageTitle>
      <section className="card">
        <div className="card-head"><h2>Aparência</h2></div>
        <p className="muted">O tema vale para o painel e para a documentação neste navegador. Não altera execução nem dados.</p>
        <SelectField
          label="Tema"
          ariaLabel="Tema da interface"
          value={theme}
          onChange={(value) => applyTheme(value as Theme)}
          options={[
            { value: "dark", label: "Escuro" },
            { value: "light", label: "Claro" },
          ]}
        />
      </section>
      <section className="card project-active">
        <div className="project-active-copy">
          <h2>Projeto ativo</h2>
          <p className="muted">Projeto selecionado no dashboard e aplicado a todas as configurações desta página.</p>
        </div>
        <div className="project-active-controls">
          <div className="switcher">
            <span>Projeto</span>
            <SelectField
              ariaLabel="Projeto nas configurações"
              value={props.workspace?.activeProjectId ?? ""}
              onChange={(value) => props.selectProject(value)}
              options={(props.workspace?.projects ?? []).length === 0
                ? [{ value: "", label: "Nenhum projeto cadastrado" }]
                : (props.workspace?.projects ?? []).map((item) => ({ value: item.id, label: item.name }))}
            />
          </div>
          <span className={`ready-pill ${project ? "tone-ok" : "tone-idle"}`}>{project ? "Projeto configurado" : "Sem projeto"}</span>
        </div>
      </section>
      <div className="split-2">
        <section className="card">
          <div className="card-head"><h2>Ambiente de teste</h2></div>
          <p className="muted">Valores efetivos do processo. O navegador não altera repositório, binário ou simulador. <DocLink slug="ambientes" onOpen={props.openHelp}>Ambientes</DocLink></p>
          <div className="form-grid readonly">
            {!isWeb ? <ReadField label="App ID / Package" value={props.prereq?.appId ?? ""} /> : null}
            {isWeb ? <ReadField label="URL da API" value={props.workspace?.activeEnvironment?.apiUrl ?? ""} /> : null}
            <ReadField label="Ambiente base" value={`${props.prereq?.environment ?? "dev"} · ${props.prereq?.apiLabel ?? "API"}`} />
            <ReadField label="Dispositivo / Alvo" value={`${props.deviceName} · ${props.prereq?.simulatorUdid || "automático"}`} />
            <ReadField label="Diretório do projeto" value={project?.repositoryPath ?? "MAESTRO_REPO não configurado"} />
          </div>
        </section>
        <section className="card" data-testid="catalog">
          <div className="card-head"><h2>Fluxos autorizados</h2></div>
          <p className="muted">{props.catalog?.error ?? "A classificação segue os scripts ou as pastas da suíte, não apenas a existência do YAML."} <DocLink slug="suites-autorizadas" onOpen={props.openHelp}>Suítes autorizadas</DocLink></p>
          <ul className="flow-switch">
            {(props.catalog?.modules ?? []).map((module) => {
              const included = module.flows.some((flow) => flow.suites.length > 0);
              return (
                <li key={module.id}>
                  <span className={`tick ${included ? "on" : ""}`} aria-hidden />
                  <div>
                    <b>{module.label}</b>
                    <span className="meta">{module.flows.length} fluxos</span>
                    <div className="flows">
                      {module.flows.map((flow) => {
                        const classified = classifyFlow(flow, props.prereq?.checks ?? null, props.prereq?.driver !== "flows");
                        return <CatalogMark key={flow.file} name={flow.name} availability={classified.availability} reason={classified.reason} />;
                      })}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="card">
          <div className="card-head"><h2>Execução</h2></div>
          <ul className="toggle-list">
            <li>
              <div className="stack-copy"><b>Modo demonstração</b><span className="meta">Usa as saídas gravadas em Execuções. Não altera o dispositivo.</span></div>
              <span className="switch off" aria-hidden />
            </li>
            <li>
              <div className="stack-copy"><b>Captura automática</b><span className="meta">Só fora de uma suíte real. Desliga sozinha durante o Maestro.</span></div>
              <button className={props.autoCapture ? "switch on" : "switch off"} type="button" role="switch" aria-checked={props.autoCapture} onClick={() => props.setAutoCapture(!props.autoCapture)} />
            </li>
            <li>
              <div className="stack-copy"><b>Gerar JUnit</b><span className="meta">Sempre ativo no runner. Não pode ser desligado aqui.</span></div>
              <span className="switch on" aria-hidden />
            </li>
            <li>
              <div className="stack-copy"><b>Sanitizar logs</b><span className="meta">Sempre ativo antes de persistir ou transmitir.</span></div>
              <span className="switch on" aria-hidden />
            </li>
          </ul>
        </section>
        <section className="card">
          <div className="card-head"><h2>Integrações</h2></div>
          <ul className="integration-list">
            <li><IconDevice /><div className="stack-copy"><b>Device Portal</b><span className="meta">{device?.message ?? "Verificando"}</span></div><span className={`tone tone-${device?.ok ? "ok" : "bad"}`}>{device?.ok ? "Conectado" : "Indisponível"}</span></li>
            <li><IconCli /><div className="stack-copy"><b>Maestro CLI</b><span className="meta">{maestro?.message ?? "Verificando"}</span></div><span className={`tone tone-${maestro?.ok ? "ok" : "bad"}`}>{maestro?.ok ? "Encontrado" : "Ausente"}</span></li>
            <li><IconScripts /><div className="stack-copy"><b>Fluxos / scripts</b><span className="meta">{scripts?.message ?? "Verificando"}</span></div><span className={`tone tone-${scripts?.ok ? "ok" : "bad"}`}>{scripts?.ok ? "Disponível" : "Ausente"}</span></li>
            <li><IconLink /><div className="stack-copy"><b>API / VPN</b><span className="meta">{api?.message ?? "Não configurada"}</span></div><span className={`tone tone-${api && !api.ok ? "warn" : "ok"}`}>{api?.ok ? "Consultada" : "Alerta"}</span></li>
          </ul>
          <p className="security-note"><IconShield /> O dashboard do Maestro QA não altera dados do repositório nem do simulador/dispositivo sem uma execução explícita de testes.</p>
          <p className="muted"><DocLink slug="conectar-agente" onOpen={props.openHelp}>Conectar agente de IA</DocLink> · <DocLink slug="seguranca" onOpen={props.openHelp}>Segurança</DocLink></p>
        </section>
      </div>
    </>
  );
}

function Projects(props: PageProps) {
  const projects = props.workspace?.projects ?? [];
  const activeId = props.workspace?.activeProjectId;
  return (
    <>
      <PageTitle title="Projetos" detail="Cadastre diretórios locais com fluxos Maestro. O cadastro não dispara testes e não clona repositório.">
        <DocLink slug="primeiro-projeto" onOpen={props.openHelp}>Como cadastrar</DocLink>
      </PageTitle>
      <section className="card">
        <div className="card-head">
          <h2>Cadastrados</h2>
          <span className="meta">{projects.length === 0 ? "Nenhum ainda" : `${projects.length} projeto(s)`}</span>
        </div>
        {projects.length === 0 ? (
          <p className="muted">Nenhum projeto cadastrado. Use o formulário abaixo. O seletor do topo só lista o que existir aqui.</p>
        ) : (
          <div className="history compact">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Diretório</th>
                  <th>Situação</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => {
                  const active = project.id === activeId;
                  return (
                    <tr key={project.id}>
                      <td>
                        <b>{project.name}</b>
                        {project.description ? <span className="meta"> {project.description}</span> : null}
                      </td>
                      <td>{PROJECT_TYPE_LABEL[project.type]}</td>
                      <td className="mono">{project.repositoryPath}</td>
                      <td>{active ? <span className="ready-pill">Ativo</span> : <span className="meta">Cadastrado</span>}</td>
                      <td>
                        {active ? null : (
                          <button className="text" type="button" onClick={() => props.selectProject(project.id)}>Ativar</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <ProjectForm existing={projects} onCreate={props.createProject} />
    </>
  );
}

function folderNameFromPath(value: string): string {
  return value.split(/[/\\]/).filter(Boolean).at(-1) ?? "";
}

function ProjectForm({
  existing,
  onCreate,
}: {
  existing: QaProject[];
  onCreate: (input: { name: string; description: string; type: "mobile" | "web" | "hybrid"; repositoryPath: string }) => void;
}) {
  const [type, setType] = useState<"mobile" | "web" | "hybrid">("mobile");
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [repositoryPath, setRepositoryPath] = useState("");
  const [picking, setPicking] = useState(false);

  async function pickFolder() {
    setPicking(true);
    setError(null);
    try {
      const response = await fetch("/api/projects/browse", { method: "POST" });
      const body = await response.json() as { path?: string | null; cancelled?: boolean; error?: string };
      if (!response.ok) {
        setError(body.error ?? "Não foi possível abrir o seletor de pasta.");
        return;
      }
      if (body.cancelled || !body.path) return;
      setRepositoryPath(body.path);
      setName((current) => current.trim() ? current : folderNameFromPath(body.path ?? ""));
    } catch {
      setError("Não foi possível abrir o seletor de pasta.");
    } finally {
      setPicking(false);
    }
  }

  return (
    <section className="card">
      <div className="card-head"><h2>Cadastrar projeto</h2></div>
      {existing.length === 0 ? <p className="muted">Nenhum projeto cadastrado. Informe um diretório local com fluxos Maestro.</p> : null}
      <form
        className="form-grid"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const nextName = String(data.get("name") ?? "").trim();
          const nextPath = String(data.get("repositoryPath") ?? "").trim();
          if (!nextName || !nextPath) {
            setError("Informe o nome e o diretório local do projeto.");
            return;
          }
          setError(null);
          onCreate({
            name: nextName,
            description: String(data.get("description") ?? ""),
            type,
            repositoryPath: nextPath,
          });
        }}
      >
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <TextField label="Nome" name="name" maxLength={80} placeholder="Nome do app" value={name} onChange={setName} />
        <TextField label="Descrição" name="description" maxLength={240} placeholder="Opcional" />
        <SelectField
          label="Tipo"
          name="type"
          value={type}
          onChange={(value) => setType(value as "mobile" | "web" | "hybrid")}
          options={[
            { value: "mobile", label: "Mobile" },
            { value: "web", label: "Web" },
            { value: "hybrid", label: "Híbrido" },
          ]}
        />
        <div className="path-field">
          <TextField
            label="Diretório local autorizado"
            name="repositoryPath"
            placeholder="/caminho/absoluto/do-app"
            value={repositoryPath}
            onChange={setRepositoryPath}
          />
          <button type="button" className="text path-field-pick" onClick={() => void pickFolder()} disabled={picking}>
            {picking ? "Aguardando pasta…" : "Escolher pasta"}
          </button>
        </div>
        <div className="row end"><button className="action" type="submit">Cadastrar sem executar testes</button></div>
      </form>
    </section>
  );
}

function DetailsPage({
  run,
  scenarios,
  logs,
  timeline,
  selectedStep,
  historical,
  deviceName,
  udid,
  connection,
  preview,
  previewAt,
  running,
  autoCapture,
  previewError,
  onBack,
  onSelect,
  onCapture,
  onEnlarge,
  onAuto,
}: {
  run: RunView | null;
  scenarios: ScenarioView[];
  logs: LogView[];
  timeline: TimelineStep[];
  selectedStep: TimelineStep | null;
  historical: boolean;
  deviceName: string;
  udid: string | null;
  connection: { label: string; tone: string };
  preview: string | null;
  previewAt: string | null;
  running: boolean;
  autoCapture: boolean;
  previewError: string | null;
  onBack: () => void;
  onSelect: (step: TimelineStep) => void;
  onCapture: () => void;
  onEnlarge: () => void;
  onAuto: (value: boolean) => void;
}) {
  return (
    <>
      <PageTitle title="Detalhes da execução" detail={run ? `${run.suiteLabel} · ${formatWhen(run.createdAt)}` : "Nenhuma execução selecionada."}>
        <button className="text" type="button" onClick={onBack}>Voltar</button>
      </PageTitle>
      {!run ? <p className="muted">Abra uma execução no histórico ou inicie uma suíte.</p> : null}
      {run?.mode === "fixture" ? <p className="demo-note">Demonstração. Estes números não são resultado de uma execução no simulador.</p> : null}
      {historical ? <p className="muted">Consulta isolada. Os cenários e logs abaixo pertencem só a esta execução.</p> : null}
      {run ? (
        <div className="detail-grid">
          <div>
            <DevicePreview
              name={run.simulatorName ?? deviceName}
              udid={udid}
              connection={connection}
              preview={preview}
              previewAt={previewAt}
              empty={historical ? "Nenhuma captura foi associada a esta execução." : "A captura do simulador não fica vinculada a um comando."}
              running={historical ? false : running}
              autoCapture={autoCapture}
              error={previewError}
              caption={historical ? "Nenhuma captura foi gravada para este comando ou para esta execução." : "A imagem é a última captura do simulador e não pertence a um comando específico."}
              controls={!historical}
              onCapture={onCapture}
              onEnlarge={onEnlarge}
              onAuto={onAuto}
            />
            <section className="card">
              <div className="card-head"><h2>Execução</h2><TestRunStatus status={run.status} /></div>
              <p className="mono">{run.id}</p>
              <p className="muted">{run.environment} · {run.apiLabel} · {formatDuration(run.durationMs)} · {run.passedCount} aprovados · {run.failedCount} reprovados</p>
              {run.errorMessage ? <FailureText text={run.errorMessage} /> : null}
              {scenarios.length === 0 ? <p className="muted">Suíte sem testes.</p> : null}
              <div className="history">
                <table>
                  <thead><tr><th>Cenário</th><th>Resultado</th><th>Duração</th><th>Falha</th></tr></thead>
                  <tbody>
                    {scenarios.map((scenario) => (
                      <tr key={scenarioKey(run.id, scenario)}>
                        <td>{scenario.name}<div className="meta">{moduleLabel(scenario.module)}</div></td>
                        <td><TestRunStatus status={scenario.status} /></td>
                        <td>{formatDuration(scenario.durationMs)}</td>
                        <td>{scenario.errorMessage ? <FailureText text={scenario.errorMessage} /> : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {run.junitPath ? <p><a href={`/api/runs/${run.id}/report`}>JUnit sanitizado</a></p> : <p className="muted">Esta execução não tem relatório JUnit.</p>}
              {selectedStep ? <p className="failure-text">{selectedStep.error ?? selectedStep.text}</p> : <p className="muted">Selecione um comando para ver o texto e a falha, quando houver.</p>}
            </section>
          </div>
          <section className="card">
            <div className="card-head"><h2>Comandos</h2><span className="meta">{timeline.length}</span></div>
            <TestRunTimeline steps={timeline} selectedKey={selectedStep?.key ?? null} onSelect={onSelect} />
            <h3 style={{ marginTop: 16 }}>Logs desta execução</h3>
            <div className="logs" data-testid="history-logs">
              {logs.map((entry) => <LogLine key={entry.id} entry={entry} />)}
              {logs.length === 0 ? <p className="muted">Sem logs desta execução.</p> : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function Metric({ label, value, tone, testId, hint }: { label: string; value: number | string; tone?: string; testId?: string; hint?: string }) {
  return (
    <article data-testid={testId}>
      <span>{label}</span>
      <strong className={tone ? `tone-${tone}` : undefined}>{value}</strong>
      {hint ? <small className="hint">{hint}</small> : null}
    </article>
  );
}

function FailureText({ text }: { text: string }) {
  if (text.length <= 180) return <p className="failure-text">{text}</p>;
  return (
    <details className="failure-expand">
      <summary>Mostrar falha completa</summary>
      <p className="failure-text">{text}</p>
    </details>
  );
}
