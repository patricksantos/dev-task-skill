"use client";

import { useEffect, useMemo, useState } from "react";
import type { CatalogReport, PrerequisiteReport, RunView } from "@/types";
import type { WorkspaceState } from "@/projects/types";
import { AGENT_PROFILES, HELP_ARTICLES, HELP_CATEGORIES, type AgentProfileId } from "@/help/content";
import { articleBySlug, headingsOf, searchArticles } from "@/help/search";
import { onboardingProgress, onboardingSteps } from "@/help/onboarding";
import type { HelpArticle, HelpBlock } from "@/help/types";
import { SelectField, TextField } from "@/components/fields";
import { IconArrow, IconHelp, IconSearch } from "@/components/icons";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";

type AppPage = "overview" | "executions" | "history" | "projects" | "settings" | "details" | "help";

export function TextLink({
  children,
  onClick,
  icon = "arrow",
}: {
  children: string;
  onClick: () => void;
  icon?: "arrow" | "help";
}) {
  const Mark = icon === "help" ? IconHelp : IconArrow;
  return (
    <button className="doc-link" type="button" onClick={onClick}>
      <Mark width={14} height={14} />
      {children}
    </button>
  );
}

export function DocLink({
  slug,
  children,
  onOpen,
}: {
  slug: string;
  children: string;
  onOpen: (slug: string) => void;
}) {
  return (
    <TextLink icon="help" onClick={() => onOpen(slug)}>
      {children}
    </TextLink>
  );
}

export function OnboardingStrip({
  workspace,
  prereq,
  catalog,
  history,
  onPage,
  onArticle,
}: {
  workspace: WorkspaceState | null;
  prereq: PrerequisiteReport | null;
  catalog: CatalogReport | null;
  history: RunView[] | null;
  onPage: (page: AppPage) => void;
  onArticle: (slug: string) => void;
}) {
  if (workspace == null || prereq == null || catalog == null || history == null) return null;
  const steps = onboardingSteps({ workspace, prereq, catalog, history });
  const progress = onboardingProgress(steps);
  if (progress.complete) return null;
  return (
    <section className="card onboarding" aria-label="Primeiros passos">
      <div className="card-head">
        <div className="stack-copy">
          <h2>Primeiros passos</h2>
          <p className="muted">O progresso usa o estado real deste workspace. Nenhuma suíte é disparada daqui.</p>
        </div>
        <span className="meta">{progress.done} de {progress.total} concluídos</span>
      </div>
      <ol className="onboarding-steps">
        {steps.map((step, index) => (
          <li key={step.id} className={step.done ? "done" : ""}>
            <span className="onboarding-mark" aria-hidden>{step.done ? "✓" : index + 1}</span>
            <div className="stack-copy">
              <b>{step.title}</b>
              <span className="meta">{step.detail}</span>
            </div>
            <div className="onboarding-actions">
              <TextLink onClick={() => onPage(step.page)}>{step.action}</TextLink>
              <DocLink slug={step.article} onOpen={onArticle}>Guia</DocLink>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function HelpCenter({
  topic,
  setTopic,
  workspace,
  prereq,
  catalog,
  history,
  onPage,
}: {
  topic: string;
  setTopic: (slug: string) => void;
  workspace: WorkspaceState | null;
  prereq: PrerequisiteReport | null;
  catalog: CatalogReport | null;
  history: RunView[] | null;
  onPage: (page: AppPage) => void;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchArticles(HELP_ARTICLES, query), [query]);
  const current = topic === "home" || !topic ? "introducao" : topic;
  const article = current !== "onboarding" && current !== "agentes" ? articleBySlug(HELP_ARTICLES, current) : null;
  const searching = query.trim().length > 0;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("help", current);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }, [current]);

  return (
    <div className="docs-site">
      <header className="docs-top">
        <button className="docs-brand" type="button" onClick={() => { setQuery(""); setTopic("introducao"); }}>
          <BrandLogo className="docs-logo" />
          <span>docs</span>
        </button>
        <label className="docs-top-search">
          <IconSearch />
          <TextField value={query} onChange={setQuery} placeholder="Buscar na documentação" ariaLabel="Buscar na documentação" />
        </label>
        <div className="docs-top-actions">
          <ThemeToggle />
          <button className="docs-back" type="button" onClick={() => onPage("overview")}>Voltar ao painel</button>
        </div>
      </header>
      <div className="docs-layout">
        <aside className="docs-side" aria-label="Índice da documentação">
          <button className={current === "onboarding" ? "docs-nav current" : "docs-nav"} type="button" onClick={() => { setQuery(""); setTopic("onboarding"); }}>Primeiros passos</button>
          <button className={current === "agentes" ? "docs-nav current" : "docs-nav"} type="button" onClick={() => { setQuery(""); setTopic("agentes"); }}>Conectar agente de IA</button>
          {HELP_CATEGORIES.map((item) => (
            <div key={item.id} className="docs-group">
              <span className="docs-group-label">{item.label}</span>
              {HELP_ARTICLES.filter((entry) => entry.category === item.id).map((entry) => (
                <button
                  key={entry.slug}
                  className={current === entry.slug ? "docs-nav current" : "docs-nav"}
                  type="button"
                  onClick={() => { setQuery(""); setTopic(entry.slug); }}
                >
                  {entry.title}
                </button>
              ))}
            </div>
          ))}
        </aside>
        <main className="docs-main">
          {searching ? (
            <SearchResults articles={results} query={query} onOpen={(slug) => { setQuery(""); setTopic(slug); }} />
          ) : null}
          {!searching && current === "onboarding" ? (
            <DocsOnboarding workspace={workspace} prereq={prereq} catalog={catalog} history={history} onPage={onPage} onArticle={setTopic} />
          ) : null}
          {!searching && current === "agentes" ? <AgentGuide onArticle={setTopic} /> : null}
          {!searching && article ? <ArticleView article={article} onOpen={setTopic} /> : null}
        </main>
      </div>
    </div>
  );
}

function SearchResults({ articles, query, onOpen }: { articles: HelpArticle[]; query: string; onOpen: (slug: string) => void }) {
  return (
    <article className="doc-article">
      <header className="docs-hero">
        <p className="docs-kicker">Busca</p>
        <h1>Resultados</h1>
        <p className="lead">{articles.length === 0 ? `Nada para “${query}”.` : `${articles.length} artigo(s) para “${query}”.`}</p>
      </header>
      <ul className="docs-search-list">
        {articles.map((article) => (
          <li key={article.slug}>
            <button className="docs-search-hit" type="button" onClick={() => onOpen(article.slug)}>
              <span className="docs-kicker">{HELP_CATEGORIES.find((item) => item.id === article.category)?.label}</span>
              <b>{article.title}</b>
              <span className="meta">{article.summary}</span>
            </button>
          </li>
        ))}
      </ul>
    </article>
  );
}

function DocsOnboarding({
  workspace,
  prereq,
  catalog,
  history,
  onPage,
  onArticle,
}: {
  workspace: WorkspaceState | null;
  prereq: PrerequisiteReport | null;
  catalog: CatalogReport | null;
  history: RunView[] | null;
  onPage: (page: AppPage) => void;
  onArticle: (slug: string) => void;
}) {
  const steps = onboardingSteps({ workspace, prereq, catalog, history });
  const progress = onboardingProgress(steps);
  return (
    <article className="doc-article">
      <header className="docs-hero">
        <p className="docs-kicker">Começar</p>
        <h1>Primeiros passos</h1>
        <p className="lead">Projeto, ambiente, alvo, suítes e a primeira execução real. O progresso é o estado deste workspace. Nada dispara sozinho.</p>
      </header>
      <p className="docs-meta-line">{progress.done} de {progress.total} concluídos</p>
      <table className="docs-table docs-steps">
        <thead>
          <tr>
            <th>Passo</th>
            <th>O que é</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((step, index) => (
            <tr key={step.id}>
              <td className="mono">{String(index + 1).padStart(2, "0")}</td>
              <td>
                <div className="docs-step-copy">
                  <b>{step.title}</b>
                  <span className="meta">{step.detail}</span>
                </div>
              </td>
              <td>
                <span className={step.done ? "docs-status ok" : "docs-status"}>{step.done ? "Pronto" : "Pendente"}</span>
              </td>
              <td>
                <div className="docs-step-actions">
                  <TextLink onClick={() => onPage(step.page)}>{step.action}</TextLink>
                  <DocLink slug={step.article} onOpen={onArticle}>Guia</DocLink>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

function ArticleView({ article, onOpen }: { article: HelpArticle; onOpen: (slug: string) => void }) {
  const toc = headingsOf(article);
  return (
    <article className="doc-article">
      <header className="docs-hero">
        <p className="docs-kicker">{HELP_CATEGORIES.find((item) => item.id === article.category)?.label}</p>
        <h1>{article.title}</h1>
        <p className="lead">{article.summary}</p>
      </header>
      {toc.length > 1 ? (
        <nav className="doc-toc" aria-label="Nesta página">
          {toc.map((item) => (
            <a key={item.id} href={`#${item.id}`}>{item.text}</a>
          ))}
        </nav>
      ) : null}
      <div className="doc-body">
        {article.blocks.map((block, index) => (
          <BlockView key={`${article.slug}-${index}`} block={block} slug={article.slug} index={index} />
        ))}
      </div>
      {article.related.length > 0 ? (
        <nav className="doc-related" aria-label="Continuar">
          <p className="docs-kicker">Continuar</p>
          {article.related.map((slug) => {
            const related = articleBySlug(HELP_ARTICLES, slug);
            return related ? (
              <button key={slug} className="docs-search-hit" type="button" onClick={() => onOpen(slug)}>
                <b>{related.title}</b>
                <span className="meta">{related.summary}</span>
              </button>
            ) : null;
          })}
        </nav>
      ) : null}
    </article>
  );
}

function BlockView({ block, slug, index }: { block: HelpBlock; slug: string; index: number }) {
  if (block.type === "p") return <p>{block.text}</p>;
  if (block.type === "h2") return <h2 id={block.id ?? `${slug}-${index}`}>{block.text}</h2>;
  if (block.type === "h3") return <h3 id={block.id ?? `${slug}-${index}`}>{block.text}</h3>;
  if (block.type === "ul") return <ul>{block.items.map((item) => <li key={item}>{item}</li>)}</ul>;
  if (block.type === "ol") return <ol>{block.items.map((item) => <li key={item}>{item}</li>)}</ol>;
  if (block.type === "code") return <CodeBlock code={block.code} label={block.label} />;
  if (block.type === "callout") {
    return (
      <aside className={`doc-callout tone-${block.tone}`}>
        {block.title ? <p className="docs-kicker">{block.title}</p> : null}
        <p>{block.text}</p>
      </aside>
    );
  }
  if (block.type === "steps") {
    return (
      <table className="docs-table">
        <thead>
          <tr><th>Passo</th><th>O que</th></tr>
        </thead>
        <tbody>
          {block.items.map((item, step) => (
            <tr key={item.title}>
              <td className="mono">{String(step + 1).padStart(2, "0")}</td>
              <td>
                <div className="docs-step-copy">
                  <b>{item.title}</b>
                  <span className="meta">{item.text}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return (
    <table className="docs-table">
      <thead>
        <tr>{block.headers.map((header) => <th key={header}>{header}</th>)}</tr>
      </thead>
      <tbody>
        {block.rows.map((row) => (
          <tr key={row.join("|")}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="code-block">
      <div className="code-head">
        <span>{label ?? "exemplo"}</span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(code).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            });
          }}
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <pre><code>{code}</code></pre>
    </div>
  );
}

function AgentGuide({ onArticle }: { onArticle: (slug: string) => void }) {
  const [agent, setAgent] = useState<AgentProfileId>("cursor");
  const profile = AGENT_PROFILES.find((item) => item.id === agent) ?? AGENT_PROFILES[0];
  return (
    <article className="doc-article">
      <header className="docs-hero">
        <p className="docs-kicker">Agentes de IA</p>
        <h1>Conectar agente de IA</h1>
        <p className="lead">Não há API de plugin. O agente usa HTTP em 127.0.0.1 e, se for explorar tela, o Maestro MCP da ferramenta — nunca os dois no mesmo dispositivo ao mesmo tempo.</p>
      </header>
      <div className="docs-agent-pick">
        <SelectField
          label="Tipo de agente"
          value={agent}
          onChange={(value) => setAgent(value as AgentProfileId)}
          options={AGENT_PROFILES.map((item) => ({ value: item.id, label: item.label }))}
        />
        <p className="meta">{profile.summary}</p>
      </div>
      <div className="doc-body">
        <h2>Pré-requisitos</h2>
        <ul>
          <li>Dashboard no ar em <span className="mono">http://127.0.0.1:4310</span>.</li>
          <li><span className="mono">GET /api/health</span> responde ok.</li>
          <li>Catálogo visível. O agente não inventa id de suíte.</li>
          {agent === "cursor" ? <li>Cursor com leitura do repositório e, se for explorar UI, Maestro MCP.</li> : null}
          {agent === "codex" ? <li>Codex com leitura do SKILL.md e rede só para localhost.</li> : null}
          {agent === "outro" ? <li>Cliente HTTP que aceite 403 fora de loopback.</li> : null}
        </ul>
        <h2>Instalação da Skill</h2>
        <p>Copie o arquivo. O dashboard não instala sozinho.</p>
        <CodeBlock label="origem" code={".agents/skills/maestro-dashboard-qa/SKILL.md"} />
        <h2>Ferramentas necessárias</h2>
        <ul>
          <li>HTTP GET/POST em <span className="mono">/api/health</span>, <span className="mono">/api/prerequisites</span>, <span className="mono">/api/catalog</span>, <span className="mono">/api/runs</span>.</li>
          <li>Opcional: Maestro MCP só para gravar ou validar YAML.</li>
        </ul>
        <h2>Prompt de validação</h2>
        <CodeBlock
          label="prompt"
          code={`Leia o README do Maestro QA Dashboard e a skill maestro-dashboard-qa.
Confirme GET http://127.0.0.1:4310/api/health, /api/prerequisites e /api/catalog.
Não dispare POST /api/runs sem eu autorizar a suíte.`}
        />
        <h2>Limitações conhecidas</h2>
        <ul>
          <li>Não existe rota <span className="mono">/api/agents</span>.</li>
          <li>Fixture não prova o aplicativo.</li>
          <li>Uma suíte por vez.</li>
        </ul>
      </div>
      <nav className="doc-related" aria-label="Continuar">
        <p className="docs-kicker">Continuar</p>
        <DocLink slug="skill-maestro-qa" onOpen={onArticle}>Artigo da Skill</DocLink>
        <DocLink slug="conectar-agente" onOpen={onArticle}>Arquitetura da integração</DocLink>
      </nav>
    </article>
  );
}
