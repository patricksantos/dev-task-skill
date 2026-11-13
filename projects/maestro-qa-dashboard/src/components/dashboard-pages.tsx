import type { ReactNode, RefObject } from "react";
import type { CatalogReport, LogStream, LogView, PrerequisiteReport, RunView, ScenarioView, SuiteId } from "@/types";
import { STATUS_LABEL, formatDuration, formatWhen } from "@/components/format";
import { CatalogMark, CommandList, LogLine, ScenarioButton } from "@/components/panels";
import {
  DevicePreview,
  ExecutionHistoryTable,
  ExecutionProgress,
  PageTitle,
  PrerequisitesStatus,
  TestRunCard,
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

type PageId = "overview" | "executions" | "history" | "settings" | "details";

const PAGES: Array<{ id: Exclude<PageId, "details">; label: string }> = [
  { id: "overview", label: "Visão geral" },
  { id: "executions", label: "Execuções" },
  { id: "history", label: "Histórico" },
  { id: "settings", label: "Configurações" },
];

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
}) {
  const historical = props.page === "details" && props.inspection != null;
  const detailRun = historical ? props.inspection?.run ?? null : props.run;
  const detailScenarios = historical ? props.inspection?.scenarios ?? [] : props.scenarios;
  const detailLogs = historical
    ? (props.inspection?.logs ?? []).filter((entry) => entry.runId === props.inspection?.run.id)
    : props.logs;
  const detailTimeline = historical ? props.pastTimeline : props.liveTimeline;
  const selectedStep = detailTimeline.find((step) => step.key === props.stepKey) ?? null;

  return (
    <div className="shell">
      <aside className="nav">
        <div className="brand">
          <strong>Maestro QA</strong>
          <span>Acompanhamento E2E</span>
        </div>
        <p className="project-chip"><small>Projeto</small><b>{props.prereq?.projectName ?? "Projeto"}</b></p>
        <nav className="nav-list" aria-label="Seções">
          {PAGES.map((item) => (
            <button key={item.id} type="button" aria-current={props.page === item.id ? "page" : undefined} onClick={() => props.setPage(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="canvas">
        {props.liveNotice ? <p className="alert">{props.liveNotice}</p> : null}
        {props.error ? <p className="alert">{props.error}</p> : null}
        {props.page === "overview" ? <Overview {...props} /> : null}
        {props.page === "executions" ? <Executions {...props} /> : null}
        {props.page === "history" ? <History {...props} /> : null}
        {props.page === "settings" ? <Settings {...props} /> : null}
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
      </main>
    </div>
  );
}

function Overview(props: Parameters<typeof DashboardPages>[0]) {
  const summary = props.overview;
  const parts = [
    `${summary.passed} aprovados`,
    `${summary.failed} reprovados`,
    summary.skipped ? `${summary.skipped} ignorados` : "",
    summary.aborted ? `${summary.aborted} interrompidos` : "",
    summary.pending ? `${summary.pending} pendentes` : "",
    summary.running ? `${summary.running} em execução` : "",
  ].filter(Boolean);
  return (
    <>
      <PageTitle title="Visão geral" detail="Ambiente e execuções reais. Demonstrações ficam no Histórico e não entram nestes números." />
      <section className="metrics" aria-label="Resumo do ambiente">
        <Metric label="Projeto" value={props.prereq?.projectName ?? "Projeto"} />
        <Metric label="Ambiente" value={`${props.prereq?.environment ?? "dev"} · ${props.prereq?.apiLabel ?? "HML"}`} />
        <Metric label="Simulador" value={props.deviceName} />
        <Metric label="Runner" value={props.runner.label} tone={props.runner.tone} />
      </section>
      <PrerequisitesStatus label={props.summary.label} tone={props.summary.tone} error={props.prereqError} checks={props.prereq?.checks ?? null} />
      {props.history == null ? <p className="muted">Carregando histórico.</p> : null}
      {props.history != null && summary.basis === "empty" ? (
        <section className="card empty-state">
          <h2>Nenhuma execução real</h2>
          <p>Ainda não há uma suíte concluída no simulador. Os indicadores de sucesso aparecem aqui depois da primeira execução real. Demonstrações podem ser abertas em Execuções e não alteram esta taxa.</p>
        </section>
      ) : null}
      {summary.last ? (
        <>
          <section className="card">
            <div className="card-head"><h2>Última execução real</h2></div>
            <TestRunCard run={summary.last} onOpen={props.openRun} />
          </section>
          <section className="metrics kpis" aria-label="Resultado das execuções reais">
            <Metric label="Cenários" value={summary.tests} />
            <Metric label="Aprovados" value={summary.passed} tone="ok" />
            <Metric label="Reprovados" value={summary.failed} tone="bad" />
            <Metric label="Sucesso" value={summary.success} tone="ok" />
          </section>
          <p className="muted">{summary.successNote} Total {summary.tests} = {parts.join(" · ")}.</p>
          <section className="card">
            <div className="card-head"><h2>Histórico recente</h2><span className="meta">Somente execuções reais</span></div>
            <div className="run-cards">
              {summary.latest.map((item) => <TestRunCard key={item.id} run={item} onOpen={props.openRun} />)}
            </div>
          </section>
          <section className="card">
            <div className="card-head"><h2>Falhas recorrentes</h2></div>
            {props.failures == null ? <p className="muted">Carregando falhas das execuções reais.</p> : null}
            {props.failures?.length === 0 ? <p className="muted">Nenhum cenário real falhou mais de uma vez.</p> : null}
            <ul className="failures">
              {(props.failures ?? []).map((item) => (
                <li key={item.name}><b>{item.name}</b><span className="meta">{item.count} reprovações</span></li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </>
  );
}

function Executions(props: Parameters<typeof DashboardPages>[0]) {
  const runKey = props.run?.id ?? "";
  return (
    <>
      <PageTitle title="Execuções" detail="Dispare uma suíte e acompanhe cenários, comandos e o simulador.">
        <TestRunStatus status={props.run?.status ?? "pending"} provisional={props.run?.status === "running"} />
      </PageTitle>
      <TestSuiteSelector
        suites={props.catalog?.suites ?? []}
        blocked={props.blocked || props.catalog == null}
        running={props.running}
        pending={props.pending}
        demoSuite={props.demoSuite}
        onDemo={props.setDemoSuite}
        onStart={props.start}
        onStop={props.stop}
      />
      {props.catalog != null && props.catalog.suites.length === 0 ? <p className="muted">Nenhuma suíte encontrada. O repositório precisa de scripts Maestro ou de fluxos em .maestro/flows.</p> : null}
      {props.run?.mode === "fixture" ? <p className="demo-note">Demonstração com saída simulada. Nenhum teste foi enviado ao simulador.</p> : null}
      {props.run?.errorMessage ? <p className="alert">{props.run.errorMessage}</p> : null}
      <section className="metrics kpis" aria-label="Resumo da execução">
        <Metric testId="metric-total" label="Cenários" value={props.indicators.total} />
        <Metric testId="metric-passed" label="Aprovados" value={props.indicators.passed} tone="ok" />
        <Metric testId="metric-failed" label="Reprovados" value={props.indicators.failed} tone="bad" />
        <Metric testId="metric-success" label="Sucesso" value={props.indicators.success} tone="ok" />
      </section>
      <p className="muted">A taxa é aprovados ÷ (aprovados + reprovados). Ignorados, interrompidos, pendentes e em execução entram no total e ficam fora da taxa.</p>
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
              <h2>Cenários</h2>
              <div className="filters">
                <label>
                  Módulo
                  <select value={props.moduleFilter} onChange={(event) => props.setModuleFilter(event.target.value)}>
                    <option value="all">Todos</option>
                    {props.modules.map((moduleName) => <option key={moduleName} value={moduleName}>{moduleLabel(moduleName)}</option>)}
                  </select>
                </label>
                <label>
                  Status
                  <select value={props.statusFilter} onChange={(event) => props.setStatusFilter(event.target.value as "all" | "pending" | "running" | "passed" | "failed" | "skipped" | "aborted")}>
                    {["all", "pending", "running", "passed", "failed", "skipped", "aborted"].map((status) => (
                      <option key={status} value={status}>{status === "all" ? "Todos" : STATUS_LABEL[status as keyof typeof STATUS_LABEL]}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            {props.run && props.scenarios.length === 0 ? <p className="muted">Suíte sem testes. Nenhum cenário foi executado.</p> : null}
            {!props.run && props.scenarios.length === 0 ? <p className="muted">Nenhuma execução em foco. Escolha uma suíte ou abra uma demonstração.</p> : null}
            {props.scenarios.length > 0 && props.visibleScenarios.length === 0 ? <p className="muted">Nenhum cenário neste filtro.</p> : null}
            <div className="scenario-list">
              {props.visibleScenarios.map((scenario) => {
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
          </section>
          <section className="card" data-testid="scenario-detail">
            <div className="card-head">
              <h2>Comandos e falha</h2>
              {props.run ? <button className="text" type="button" onClick={() => { props.setInspection(null); props.setPage("details"); }}>Ver detalhes</button> : null}
            </div>
            {props.selected ? (
              <>
                <p><b>{props.selected.name}</b> · {moduleLabel(props.selected.module)}</p>
                <TestRunStatus status={props.selected.status} provisional={!props.selected.confirmed && props.selected.status === "running"} />
                <FailureText text={detailFailure(props.selected)} />
                {confirmationNote(props.selected) ? <p className="muted">{confirmationNote(props.selected)}</p> : null}
                <p className="muted">Duração {formatDuration(scenarioDuration(props.selected, props.now))}</p>
                <CommandList steps={props.steps} />
                <button className="link" type="button" onClick={() => props.showScenarioLogs(props.selected as ScenarioView)}>Ver logs relacionados</button>
              </>
            ) : <p className="muted">Selecione um cenário para ver os comandos e a falha completa.</p>}
          </section>
          <section className="card" ref={props.logSection}>
            <div className="card-head">
              <h2>Logs</h2>
              <div className="filters">
                {(["all", "stdout", "stderr"] as const).map((item) => (
                  <button key={item} className="text" type="button" aria-pressed={props.stream === item} onClick={() => props.setStream(item)}>
                    {item === "all" ? "Tudo" : item}
                  </button>
                ))}
                <input value={props.query} onChange={(event) => props.setQuery(event.target.value)} placeholder="Buscar" aria-label="Buscar nos logs" />
                <label className="auto">
                  <input type="checkbox" checked={props.autoScroll} onChange={(event) => props.setAutoScroll(event.target.checked)} />
                  Rolagem automática
                </label>
              </div>
            </div>
            {props.selected ? <p className="muted">Eventos de {props.selected.name}. <button className="link" type="button" onClick={() => props.setFocusKey(null)}>Limpar seleção</button></p> : null}
            <div className="logs" data-testid="log-panel">
              {props.visibleLogs.map((entry) => <LogLine key={entry.id} entry={entry} />)}
              {props.visibleLogs.length === 0 ? <p className="muted">Sem linhas para o filtro atual.</p> : null}
              <div ref={props.logEnd} />
            </div>
          </section>
        </div>
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
          onCapture={() => void props.capture()}
          onEnlarge={() => props.preview && props.setEnlarge(true)}
          onAuto={props.setAutoCapture}
        />
      </div>
    </>
  );
}

function History(props: Parameters<typeof DashboardPages>[0]) {
  return (
    <>
      <PageTitle title="Histórico" detail="Cada linha é uma execução. Demonstrações não são resultado do simulador.">
        <div className="filters">
          {(["all", "real", "demo"] as const).map((item) => (
            <button key={item} className="text" type="button" aria-pressed={props.historyFilter === item} onClick={() => props.setHistoryFilter(item)}>
              {item === "all" ? "Todas" : item === "real" ? "Reais" : "Demonstração"}
            </button>
          ))}
        </div>
      </PageTitle>
      <section className="card" data-testid="history">
          <ExecutionHistoryTable
            projectName={props.prereq?.projectName ?? "Projeto"}
            rows={props.historyRows}
            loading={props.history == null}
            empty={props.historyFilter === "real" ? "Nenhuma execução real neste histórico." : "Nenhuma execução neste filtro."}
            onOpen={props.openRun}
          />
      </section>
    </>
  );
}

function Settings(props: Parameters<typeof DashboardPages>[0]) {
  return (
    <>
      <PageTitle title="Configurações" detail="Valores efetivos do processo. O navegador não altera repositório, binário ou simulador." />
      <PrerequisitesStatus label={props.summary.label} tone={props.summary.tone} error={props.prereqError} checks={props.prereq?.checks ?? null} />
      <section className="card">
        <div className="card-head"><h2>Ambiente</h2></div>
        <dl className="device">
          <div><dt>App</dt><dd className="mono">{props.prereq?.appId ?? "—"}</dd></div>
          <div><dt>Ambiente</dt><dd>{props.prereq?.environment ?? "dev"} · {props.prereq?.apiLabel ?? "HML"}</dd></div>
          <div><dt>Simulador</dt><dd className="udid">{props.prereq?.simulatorUdid ?? "—"}</dd></div>
        </dl>
        <p className="muted">O repositório, o app, o dispositivo e a API vêm do ambiente do processo: MAESTRO_REPO, MAESTRO_APP_ID, MAESTRO_PROJECT_NAME, MAESTRO_UDID, MAESTRO_API_URL e MAESTRO_BIN.</p>
      </section>
      <section className="card" data-testid="catalog">
        <div className="card-head">
          <h2>Fluxos autorizados</h2>
          <span className="muted">{props.catalog?.error ?? "A classificação segue os scripts, não apenas a existência do YAML."}</span>
        </div>
        {props.catalog == null ? <p className="muted">Carregando catálogo.</p> : null}
        <div className="catalog">
          {(props.catalog?.modules ?? []).map((module) => (
            <article key={module.id}>
              <h3>{module.label}</h3>
              <div className="flows">
                {module.flows.map((flow) => {
                  const classified = classifyFlow(flow, props.prereq?.checks ?? null, props.prereq?.driver !== "flows");
                  return <CatalogMark key={flow.file} name={flow.name} availability={classified.availability} reason={classified.reason} />;
                })}
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
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
