"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CatalogReport, DashboardEvent, LogStream, LogView, PrerequisiteReport, RunView, ScenarioView, SuiteId } from "@/types";
import type { ProjectDiscovery, WorkspaceState } from "@/projects/types";
import { elapsedMs } from "@/components/format";
import { DashboardPages } from "@/components/dashboard-pages";
import {
  boardIndicators,
  commandSteps,
  executionProgress,
  executionTimeline,
  filterHistory,
  filterLogs,
  filterScenarios,
  foldLiveEvent,
  historySummary,
  prereqSummary,
  recurringFailures,
  runnerLabel,
  scenarioKey,
  simulatorConnection,
  type HistoryFilter,
  type LiveBoard,
} from "@/components/view-model";

interface Details {
  run: RunView;
  scenarios: ScenarioView[];
  logs: LogView[];
}

const STATUS_FILTERS = ["all", "pending", "running", "passed", "failed", "skipped", "aborted"] as const;
type PageId = "overview" | "executions" | "history" | "projects" | "settings" | "details" | "help";

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? "Não foi possível concluir a ação.";
}

export function Dashboard() {
  const [prereq, setPrereq] = useState<PrerequisiteReport | null>(null);
  const [prereqError, setPrereqError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogReport | null>(null);
  const [run, setRun] = useState<RunView | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioView[]>([]);
  const [logs, setLogs] = useState<LogView[]>([]);
  const [history, setHistory] = useState<RunView[] | null>(null);
  const [failures, setFailures] = useState<Array<{ name: string; count: number }> | null>(null);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [error, setError] = useState<string | null>(null);
  const [liveNotice, setLiveNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [stream, setStream] = useState<LogStream | "all">("all");
  const [query, setQuery] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [moduleFilter, setModuleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [demoSuite, setDemoSuite] = useState<SuiteId>("smoke");
  const [preview, setPreview] = useState<string | null>(null);
  const [previewAt, setPreviewAt] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [autoCapture, setAutoCapture] = useState(false);
  const [enlarge, setEnlarge] = useState(false);
  const [inspection, setInspection] = useState<Details | null>(null);
  const [page, setPage] = useState<PageId>("overview");
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
  const [discovery, setDiscovery] = useState<ProjectDiscovery | null>(null);
  const [confirm, setConfirm] = useState<{ suite: SuiteId; mode: "script" | "fixture" } | null>(null);
  const [scenarioQuery, setScenarioQuery] = useState("");
  const [scenarioPage, setScenarioPage] = useState(1);
  const [historySuite, setHistorySuite] = useState("all");
  const [historyResult, setHistoryResult] = useState("all");
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [helpTopic, setHelpTopic] = useState("introducao");
  const [stepKey, setStepKey] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const logEnd = useRef<HTMLDivElement | null>(null);
  const logSection = useRef<HTMLElement | null>(null);
  const capturing = useRef(false);
  const runningRef = useRef(false);
  const boardRef = useRef<LiveBoard>({ run: null, scenarios: [], logs: [] });
  const previousStatus = useRef<RunView["status"] | null>(null);

  const running = run?.status === "running";
  runningRef.current = running;

  useEffect(() => {
    const help = new URLSearchParams(window.location.search).get("help");
    if (help) {
      setPage("help");
      setHelpTopic(help === "home" ? "introducao" : help);
    }
  }, []);

  const reloadProjectData = useCallback(() => {
    void fetch("/api/projects", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readError(response));
        const body = (await response.json()) as WorkspaceState & { discovery: ProjectDiscovery | null };
        setWorkspace(body);
        setDiscovery(body.discovery);
      })
      .catch(() => {
        setWorkspace({
          projects: [],
          environments: [],
          activeProjectId: null,
          activeEnvironmentId: null,
          activeProject: null,
          activeEnvironment: null,
        });
      });
    void fetch("/api/catalog", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as CatalogReport & { error?: string };
        if (!response.ok || !Array.isArray(body.suites) || !Array.isArray(body.modules)) {
          setCatalog({ modules: [], suites: [], error: body.error ?? "Catálogo indisponível." });
          return;
        }
        setCatalog({ modules: body.modules, suites: body.suites, error: body.error ?? null });
      })
      .catch(() => setCatalog({ modules: [], suites: [], error: "Catálogo indisponível." }));
    void refreshHistory().then(setHistory).catch(() => setHistory([]));
    void fetch("/api/prerequisites", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readError(response));
        setPrereq((await response.json()) as PrerequisiteReport);
        setPrereqError(null);
      })
      .catch((reason: unknown) => setPrereqError(reason instanceof Error ? reason.message : "Falha ao verificar pré-requisitos."));
  }, []);

  useEffect(() => {
    reloadProjectData();
    const timer = setInterval(reloadProjectData, 20000);
    return () => clearInterval(timer);
  }, [reloadProjectData]);

  useEffect(() => {
    const source = new EventSource("/api/events");
    source.onopen = () => setLiveNotice(null);
    source.onerror = () => setLiveNotice("Conexão ao vivo interrompida. Tentando reconectar.");
    source.onmessage = (event) => {
      const payload = JSON.parse(event.data) as DashboardEvent;
      const next = foldLiveEvent(boardRef.current, payload);
      const runChanged = next.run?.id !== boardRef.current.run?.id;
      boardRef.current = next;
      setRun(next.run);
      setScenarios(next.scenarios);
      setLogs(next.logs);
      if (runChanged) {
        setFocusKey(null);
        setStepKey(null);
      }
    };
    return () => source.close();
  }, []);

  useEffect(() => {
    if (run?.status && run.status !== "running") {
      void refreshHistory().then(setHistory).catch(() => undefined);
    }
  }, [run?.id, run?.status]);

  useEffect(() => {
    if (history == null) return;
    const targets = history.filter((item) => item.mode === "script" && item.failedCount > 0).slice(0, 12);
    if (targets.length === 0) {
      setFailures([]);
      return;
    }
    let cancelled = false;
    void Promise.all(targets.map(async (item) => {
      const response = await fetch(`/api/runs/${item.id}`);
      if (!response.ok) return [] as string[];
      const body = (await response.json()) as { scenarios?: ScenarioView[] };
      return (body.scenarios ?? []).filter((scenario) => scenario.status === "failed").map((scenario) => scenario.name);
    }))
      .then((groups) => {
        if (!cancelled) setFailures(recurringFailures(groups.flat()));
      })
      .catch(() => {
        if (!cancelled) setFailures([]);
      });
    return () => {
      cancelled = true;
    };
  }, [history]);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running, run?.id]);

  const capture = useCallback(async () => {
    if (capturing.current || runningRef.current) return;
    capturing.current = true;
    setPreviewError(null);
    try {
      const response = await fetch("/api/simulator/screenshot");
      if (!response.ok) {
        setPreviewError(await readError(response));
        return;
      }
      const blob = await response.blob();
      setPreview((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(blob);
      });
      setPreviewAt(new Date().toISOString());
    } finally {
      capturing.current = false;
    }
  }, []);

  useEffect(() => {
    const previous = previousStatus.current;
    previousStatus.current = run?.status ?? null;
    if (previous === "running" && run && run.status !== "running" && run.mode === "script") {
      void capture();
    }
  }, [run?.id, run?.status, run?.mode, capture]);

  useEffect(() => {
    if (!autoCapture || running) return;
    const timer = setInterval(() => {
      if (!runningRef.current) void capture();
    }, 8000);
    return () => clearInterval(timer);
  }, [autoCapture, running, capture]);

  const runKey = run?.id ?? "";
  const selected = scenarios.find((scenario) => scenarioKey(runKey, scenario) === focusKey) ?? null;
  const steps = selected ? commandSteps(logs.filter((entry) => entry.runId === runKey), selected.name) : [];
  const visibleLogs = useMemo(
    () => filterLogs(logs.filter((entry) => !run || entry.runId === run.id), { stream, query, scenario: selected?.name ?? null }),
    [logs, stream, query, selected?.name, run],
  );

  useEffect(() => {
    if (!autoScroll) return;
    logEnd.current?.scrollIntoView({ block: "nearest" });
  }, [visibleLogs.length, autoScroll]);

  const progress = executionProgress(scenarios);
  const elapsed = elapsedMs(run?.startedAt ?? null, run?.finishedAt ?? null, run?.durationMs ?? null, now);
  const runner = runnerLabel(run, pending);
  const summary = prereqSummary(prereq);
  const simulatorReady = prereq ? prereq.checks.some((check) => check.id === "simulator" && check.ok) : null;
  const connection = simulatorConnection(simulatorReady, running);
  const blocked = !prereq?.ready || running || pending;
  const modules = [...new Set(scenarios.map((scenario) => scenario.module).filter((value): value is string => Boolean(value)))];
  const visibleScenarios = filterScenarios(scenarios, moduleFilter, statusFilter);
  const historyRows = filterHistory(history ?? [], historyFilter);
  const indicators = boardIndicators(run, scenarios);
  const overview = historySummary(history ?? []);
  const liveTimeline = useMemo(() => (run ? executionTimeline(scenarios, logs, run.id) : []), [run, scenarios, logs]);
  const pastTimeline = useMemo(
    () => (inspection ? executionTimeline(inspection.scenarios, inspection.logs, inspection.run.id) : []),
    [inspection],
  );

  const deviceName = prereq?.simulatorName ?? run?.simulatorName ?? "não identificado";

  function showScenarioLogs(scenario: ScenarioView) {
    if (!run) return;
    setFocusKey(scenarioKey(run.id, scenario));
    logSection.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function start(suite: SuiteId, mode: "script" | "fixture") {
    setPending(true);
    setError(null);
    setFocusKey(null);
    setStepKey(null);
    setPage("executions");
    setModuleFilter("all");
    setStatusFilter("all");
    const response = await fetch("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suite, mode }),
    });
    setPending(false);
    if (!response.ok) setError(await readError(response));
  }

  async function stop() {
    if (!run || !running) return;
    const response = await fetch(`/api/runs/${run.id}/stop`, { method: "POST" });
    if (!response.ok) setError(await readError(response));
  }

  async function selectProject(projectId: string, environmentId?: string | null) {
    if (!projectId) return;
    const response = await fetch(`/api/projects/${projectId}/select`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(environmentId ? { environmentId } : {}),
    });
    if (!response.ok) {
      setError(await readError(response));
      return;
    }
    setModuleFilter("all");
    setScenarioPage(1);
    setHistoryPage(1);
    await reloadProjectData();
  }

  async function createProject(input: { name: string; description: string; type: "mobile" | "web" | "hybrid"; repositoryPath: string }) {
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      setError(await readError(response));
      return;
    }
    await reloadProjectData();
    setPage("projects");
  }

  async function openRun(id: string) {
    const response = await fetch(`/api/runs/${id}`);
    if (!response.ok) {
      setError(await readError(response));
      return;
    }
    setInspection((await response.json()) as Details);
    setStepKey(null);
    setPage("details");
  }

  return (
    <DashboardPages
      page={page}
      setPage={setPage}
      prereq={prereq}
      prereqError={prereqError}
      catalog={catalog}
      run={run}
      scenarios={scenarios}
      logs={logs}
      history={history}
      historyRows={historyRows}
      historyFilter={historyFilter}
      setHistoryFilter={setHistoryFilter}
      error={error}
      liveNotice={liveNotice}
      pending={pending}
      stream={stream}
      setStream={setStream}
      query={query}
      setQuery={setQuery}
      autoScroll={autoScroll}
      setAutoScroll={setAutoScroll}
      moduleFilter={moduleFilter}
      setModuleFilter={setModuleFilter}
      statusFilter={statusFilter}
      setStatusFilter={setStatusFilter}
      focusKey={focusKey}
      setFocusKey={setFocusKey}
      demoSuite={demoSuite}
      setDemoSuite={setDemoSuite}
      preview={preview}
      previewAt={previewAt}
      previewError={previewError}
      autoCapture={autoCapture}
      setAutoCapture={setAutoCapture}
      enlarge={enlarge}
      setEnlarge={setEnlarge}
      inspection={inspection}
      setInspection={setInspection}
      stepKey={stepKey}
      setStepKey={setStepKey}
      now={now}
      logEnd={logEnd}
      logSection={logSection}
      running={running}
      blocked={blocked}
      selected={selected}
      steps={steps}
      visibleLogs={visibleLogs}
      progress={progress}
      elapsed={elapsed}
      runner={runner}
      summary={summary}
      connection={connection}
      modules={modules}
      visibleScenarios={visibleScenarios}
      indicators={indicators}
      overview={overview}
      failures={failures}
      liveTimeline={liveTimeline}
      pastTimeline={pastTimeline}
      deviceName={deviceName}
      showScenarioLogs={showScenarioLogs}
      start={(suite, mode) => void start(suite, mode)}
      stop={() => void stop()}
      openRun={(id) => void openRun(id)}
      capture={() => void capture()}
      workspace={workspace}
      discovery={discovery}
      selectProject={(projectId, environmentId) => void selectProject(projectId, environmentId)}
      createProject={(input) => void createProject(input)}
      confirm={confirm}
      setConfirm={setConfirm}
      scenarioQuery={scenarioQuery}
      setScenarioQuery={setScenarioQuery}
      scenarioPage={scenarioPage}
      setScenarioPage={setScenarioPage}
      historySuite={historySuite}
      setHistorySuite={setHistorySuite}
      historyResult={historyResult}
      setHistoryResult={setHistoryResult}
      historyQuery={historyQuery}
      setHistoryQuery={setHistoryQuery}
      historyPage={historyPage}
      setHistoryPage={setHistoryPage}
      helpTopic={helpTopic}
      setHelpTopic={setHelpTopic}
    />
  );
}

async function refreshHistory(): Promise<RunView[]> {
  const response = await fetch("/api/runs");
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as { runs: RunView[] };
  return body.runs;
}
