import type { ReactNode } from "react";
import type { CatalogSuite, PrerequisiteCheck, RunView, SuiteId } from "@/types";
import { SelectField } from "@/components/fields";
import { STATUS_LABEL, formatDuration, formatPercent, formatWhen } from "@/components/format";
import { HistoryMark, ProgressBar } from "@/components/panels";
import { IconArrow } from "@/components/icons";
import type { TimelineStep } from "@/components/view-model";

type StatusName = keyof typeof STATUS_LABEL;

export function TestRunStatus({ status, provisional = false }: { status: StatusName; provisional?: boolean }) {
  const tone = provisional ? "running" : status;
  const label = provisional ? "Provisório" : STATUS_LABEL[status];
  return (
    <span className={`pill pill-${tone}`}>
      <i />
      {label}
    </span>
  );
}

export function TestRunCard({ run, onOpen }: { run: RunView; onOpen: (id: string) => void }) {
  return (
    <button className="run-card" type="button" onClick={() => onOpen(run.id)}>
      <span className="meta">{formatWhen(run.createdAt)}</span>
      <span>
        <b>{run.suiteLabel}</b>
        <span className="meta"> {run.passedCount} aprovados · {run.failedCount} reprovados</span>
      </span>
      {run.mode === "fixture" ? <HistoryMark demo>{null}</HistoryMark> : <HistoryMark demo={false}>{null}</HistoryMark>}
      <TestRunStatus status={run.status} />
    </button>
  );
}

export function ExecutionProgress({
  confirmed,
  total,
  current,
  command,
  elapsed,
  state,
  demo,
  pending = 0,
  skipped = 0,
}: {
  confirmed: number;
  total: number;
  current: string | null;
  command: string | null;
  elapsed: string;
  state: string;
  demo: boolean;
  pending?: number;
  skipped?: number;
}) {
  return (
    <ProgressBar
      confirmed={confirmed}
      total={total}
      current={current}
      command={command}
      elapsed={elapsed}
      state={state}
      demo={demo}
      pending={pending}
      skipped={skipped}
    />
  );
}

export function TestStepRow({
  step,
  selected,
  onSelect,
}: {
  step: TimelineStep;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button className={selected ? "step selected" : "step"} type="button" aria-pressed={selected} onClick={onSelect}>
      <span className="meta">{step.order}</span>
      <span>
        <b>{step.command ?? step.text}</b>
        <small> {step.scenarioName} · {formatWhen(step.at)}{step.durationMs != null ? ` · ${formatDuration(step.durationMs)}` : ""}</small>
        {selected && step.command ? <small> {step.text}</small> : null}
        {selected && step.error ? <span className="failure-text">{step.error}</span> : null}
      </span>
      <TestRunStatus status={step.signal === "passed" ? "passed" : step.signal === "failed" ? "failed" : step.signal === "skipped" ? "skipped" : "running"} />
    </button>
  );
}

export function TestRunTimeline({
  steps,
  selectedKey,
  onSelect,
}: {
  steps: TimelineStep[];
  selectedKey: string | null;
  onSelect: (step: TimelineStep) => void;
}) {
  if (steps.length === 0) return <p className="muted">Nenhum comando foi associado a esta execução.</p>;
  return (
    <div>
      {steps.map((step) => (
        <TestStepRow key={step.key} step={step} selected={selectedKey === step.key} onSelect={() => onSelect(step)} />
      ))}
    </div>
  );
}

export function DevicePreview({
  name,
  udid,
  connection,
  preview,
  previewAt,
  empty,
  running,
  autoCapture,
  error,
  caption,
  controls = true,
  kind = "mobile",
  onCapture,
  onEnlarge,
  onAuto,
}: {
  name: string;
  udid: string | null;
  connection: { label: string; tone: string };
  preview: string | null;
  previewAt: string | null;
  empty: string;
  running: boolean;
  autoCapture: boolean;
  error: string | null;
  caption?: string;
  controls?: boolean;
  kind?: "mobile" | "web" | "hybrid";
  onCapture: () => void;
  onEnlarge: () => void;
  onAuto: (value: boolean) => void;
}) {
  const web = kind === "web";
  return (
    <section className="card" data-testid="simulator-card">
      <div className="card-head">
        <h2>{web ? "Navegador" : "Dispositivo de execução"}</h2>
        <span className={`tone tone-${connection.tone}`}>{connection.label}</span>
      </div>
      <div className="device-stage">
        <div className={web ? "device-frame web" : "device-frame"}>
          <button className={web ? "preview device-screen web-screen" : "preview device-screen"} type="button" disabled={!preview} onClick={onEnlarge}>
            {preview ? <img src={preview} alt={`Captura estática de ${name} em ${formatWhen(previewAt)}`} /> : (
              <span className="preview-empty">
                <b>Sem captura</b>
                <span>{empty}</span>
              </span>
            )}
          </button>
        </div>
        <dl className="device">
          <div><dt>Dispositivo</dt><dd>{name}</dd></div>
          <div><dt>UDID</dt><dd className="udid" title={udid ?? undefined}>{udid ?? "—"}</dd></div>
          <div><dt>Captura</dt><dd>{previewAt ? formatWhen(previewAt) : "Nenhuma"}</dd></div>
          <div><dt>Tipo</dt><dd>Imagem estática</dd></div>
        </dl>
      </div>
      {controls ? (
      <div className="row">
        <button className="text" type="button" disabled={running} onClick={onCapture}>Capturar</button>
        <button className="text" type="button" disabled={!preview} onClick={onEnlarge}>Ampliar</button>
        <button
          className={autoCapture ? "switch on" : "switch off"}
          type="button"
          role="switch"
          aria-label="Captura automática"
          aria-checked={autoCapture}
          disabled={running}
          onClick={() => onAuto(!autoCapture)}
        />
        <span className="muted">Automática</span>
      </div>
      ) : null}
      <p className="muted">{caption ?? (running ? "A captura fica desligada enquanto o Maestro controla o simulador. A última imagem continua visível." : "As imagens são capturas estáticas. Não há transmissão ao vivo, e a captura não disputa o simulador com o Maestro.")}</p>
      {error ? <p className="alert">{error}</p> : null}
    </section>
  );
}

export function TestSuiteSelector({
  suites,
  blocked,
  running,
  pending,
  demoSuite,
  onDemo,
  onStart,
  onStop,
}: {
  suites: CatalogSuite[];
  blocked: boolean;
  running: boolean;
  pending: boolean;
  demoSuite: SuiteId;
  onDemo: (suite: SuiteId) => void;
  onStart: (suite: SuiteId, mode: "script" | "fixture") => void;
  onStop: () => void;
}) {
  return (
    <section className="toolbar" aria-label="Controle de execução">
      {suites.map((suite) => (
        <button
          key={suite.id}
          className={suite.id === "all" ? "action" : "text"}
          type="button"
          data-testid={`run-${suite.id}`}
          aria-label={`Executar ${suite.label === "Todos" ? "todos" : suite.label}`}
          disabled={blocked}
          onClick={() => onStart(suite.id, "script")}
        >
          {suite.id === "all" ? "Executar suíte" : `Executar ${suite.label.toLowerCase()}`}
        </button>
      ))}
      <button className="text danger" type="button" data-testid="stop-run" disabled={!running} onClick={onStop}>Interromper</button>
      <div className="auto demo-pick">
        <span>Demonstração</span>
        <SelectField
          ariaLabel="Exemplo de demonstração"
          value={demoSuite}
          disabled={running || pending}
          onChange={(value) => onDemo(value as SuiteId)}
          options={[
            { value: "smoke", label: "Um reprovado" },
            { value: "stores", label: "Todos aprovados" },
            { value: "coupons", label: "Falha de infraestrutura" },
            { value: "navigation", label: "Suíte sem testes" },
          ]}
        />
      </div>
      <button className="text" type="button" data-testid="run-fixture" title="Reproduz uma saída simulada, sem usar o simulador" disabled={running || pending} onClick={() => onStart(demoSuite, "fixture")}>Abrir</button>
    </section>
  );
}

export function ExecutionHistoryTable({
  projectName,
  rows,
  loading,
  empty,
  onOpen,
}: {
  projectName: string;
  rows: RunView[];
  loading: boolean;
  empty: string;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="history">
      {loading ? <p className="muted">Carregando histórico.</p> : null}
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Projeto</th>
            <th>Suíte</th>
            <th>Dispositivo</th>
            <th>Ambiente</th>
            <th>Duração</th>
            <th>Aprovados</th>
            <th>Reprovados</th>
            <th>Sucesso</th>
            <th>Resultado</th>
            <th>Relatório</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.id} className={item.mode === "fixture" ? "demo-row" : undefined} data-run-id={item.id}>
              <td>
                <button className="doc-link" type="button" onClick={() => onOpen(item.id)}>
                  <IconArrow width={14} height={14} />
                  {formatWhen(item.createdAt)}
                </button>
              </td>
              <td>{projectName}</td>
              <td>{item.suiteLabel}</td>
              <td>{item.simulatorName ?? "—"}</td>
              <td>{item.environment} · {item.apiLabel}</td>
              <td>{formatDuration(item.durationMs)}</td>
              <td>{item.passedCount}</td>
              <td className={item.failedCount ? "tone-bad" : undefined}>{item.failedCount}</td>
              <td>{item.passedCount + item.failedCount > 0 && item.status !== "running" && item.status !== "aborted" ? formatPercent(item.passedCount, item.passedCount + item.failedCount) : "—"}</td>
              <td>
                <div className="result-cell">
                  {item.mode === "fixture" ? <HistoryMark demo>{null}</HistoryMark> : <HistoryMark demo={false}>{null}</HistoryMark>}
                  <TestRunStatus status={item.status} />
                </div>
              </td>
              <td>{item.junitPath ? <a href={`/api/runs/${item.id}/report`}>JUnit</a> : "—"}</td>
            </tr>
          ))}
          {!loading && rows.length === 0 ? <tr><td colSpan={11}>{empty}</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

export function PrerequisitesStatus({
  label,
  tone,
  error,
  checks,
}: {
  label: string;
  tone: string;
  error: string | null;
  checks: PrerequisiteCheck[] | null;
}) {
  return (
    <section className="card" data-testid="prereq-banner">
      <div className="card-head">
        <h2>Pré-requisitos</h2>
        <span className={`tone tone-${tone}`}>{label}</span>
      </div>
      {error ? <p className="alert">{error}</p> : null}
      {checks ? (
        <div className="checks">
          {checks.map((check) => (
            <p key={check.id} className={check.ok ? "check" : check.level === "warning" ? "check warn" : "check bad"}>
              <b>{check.label}</b>
              <span>{check.message}</span>
            </p>
          ))}
        </div>
      ) : (
        <p className="muted">Verificando binário, scripts, simulador e API de homologação.</p>
      )}
    </section>
  );
}

export function PageTitle({ title, detail, children }: { title: string; detail?: string; children?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {detail ? <p>{detail}</p> : null}
      </div>
      {children}
    </header>
  );
}
