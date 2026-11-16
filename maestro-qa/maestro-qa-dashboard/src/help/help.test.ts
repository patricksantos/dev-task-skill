import assert from "node:assert/strict";
import test from "node:test";
import { HELP_ARTICLES, HELP_CATEGORIES } from "@/help/content";
import { onboardingProgress, onboardingSteps } from "@/help/onboarding";
import { articleBySlug, headingsOf, searchArticles } from "@/help/search";

test("a documentação cobre as categorias e slugs pedidos", () => {
  const slugs = HELP_ARTICLES.map((article) => article.slug);
  for (const slug of [
    "introducao",
    "arquitetura",
    "instalacao",
    "primeiro-projeto",
    "ambientes",
    "descoberta-modulos",
    "suites-autorizadas",
    "executar-testes",
    "monitoramento",
    "evidencias",
    "junit",
    "historico",
    "conectar-agente",
    "skill-maestro-qa",
    "seguranca",
    "troubleshooting",
    "resultados",
  ]) {
    assert.equal(slugs.includes(slug), true, slug);
  }
  assert.equal(HELP_CATEGORIES.length >= 5, true);
  const agent = articleBySlug(HELP_ARTICLES, "conectar-agente");
  assert.match(agent?.summary ?? "", /Não há rota de plugin/);
  assert.equal(HELP_ARTICLES.some((article) => /em breve|roadmap|coming soon/i.test(article.summary)), false);
});

test("a busca encontra JUnit e ignora tokens ausentes", () => {
  const junit = searchArticles(HELP_ARTICLES, "junit xml");
  assert.equal(junit.some((article) => article.slug === "junit"), true);
  const none = searchArticles(HELP_ARTICLES, "teletransporte quântico");
  assert.equal(none.length, 0);
  assert.equal(searchArticles(HELP_ARTICLES, "").length, HELP_ARTICLES.length);
  const intro = articleBySlug(HELP_ARTICLES, "introducao");
  assert.ok(intro);
  assert.equal(headingsOf(intro!).length > 0, true);
});

test("o onboarding reflete projeto, catálogo e execução real", () => {
  const empty = onboardingSteps({ workspace: null, prereq: null, catalog: null, history: null });
  assert.equal(empty.every((step) => step.done === false), true);
  assert.equal(onboardingProgress(empty).complete, false);
  assert.equal(empty.some((step) => step.action.includes("Cadastrar")), true);
  assert.equal(empty.find((step) => step.id === "project")?.page, "projects");

  const ready = onboardingSteps({
    workspace: {
      projects: [],
      environments: [{ id: "e1", projectId: "p1", name: "dev", label: "dev", apiUrl: null, apiLabel: "API", production: false, createdAt: "" }],
      activeProjectId: "p1",
      activeEnvironmentId: "e1",
      activeProject: { id: "p1", name: "Loja", description: "", type: "mobile", repositoryPath: "/tmp/app", enabled: true, createdAt: "", updatedAt: "" },
      activeEnvironment: { id: "e1", projectId: "p1", name: "dev", label: "dev", apiUrl: null, apiLabel: "API", production: false, createdAt: "" },
    },
    prereq: {
      ready: true,
      checkedAt: "",
      environment: "dev",
      apiLabel: "API",
      appId: "app",
      projectName: "Loja",
      driver: "flows",
      simulatorUdid: "x",
      simulatorName: "iPhone",
      checks: [{ id: "simulator", label: "Simulador", ok: true, level: "required", message: "ligado" }],
    },
    catalog: { suites: [{ id: "login", label: "Login" }], modules: [], error: null },
    history: [{
      id: "r1",
      projectId: "p1",
      createdAt: "",
      startedAt: null,
      finishedAt: null,
      environment: "dev",
      apiLabel: "API",
      appId: "app",
      simulatorUdid: "x",
      simulatorName: "iPhone",
      suite: "login",
      suiteLabel: "Login",
      mode: "script",
      status: "failed",
      durationMs: 1,
      passedCount: 0,
      failedCount: 1,
      skippedCount: 0,
      abortedCount: 0,
      runningCount: 0,
      pendingCount: 0,
      totalCount: 1,
      exitCode: 1,
      junitPath: null,
      errorMessage: null,
    }],
  });
  assert.equal(onboardingProgress(ready).complete, true);
  assert.equal(ready.find((step) => step.id === "run")?.detail.includes("execução real"), true);
});
