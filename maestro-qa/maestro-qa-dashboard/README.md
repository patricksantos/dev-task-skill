# Maestro QA Dashboard

Dashboard local para cadastrar projetos com fluxos Maestro, executar suítes autorizadas e guardar evidências. O processo escuta só em `http://127.0.0.1:4310`. O `POST /api/runs` aceita só o id da suíte e o modo; não existe comando livre.

O dashboard não compila, não instala e não clona o app. O build de debug já precisa estar no dispositivo (ou o alvo web no Chromium), e os YAML já precisam existir em `.maestro/flows` ou nos scripts `run_maestro_*.sh` conhecidos.

O alvo efetivo é o **projeto ativo**: um diretório local absoluto cadastrado em SQLite (`qa_projects`). `MAESTRO_REPO` no processo, se for um caminho absoluto válido, entra como projeto inicial. Sem projeto ativo, nenhuma suíte real fica disponível. Confirme `projectName` e `appId` em `GET /api/prerequisites` antes de disparar uma suíte real.

## Interface

A SPA cobre operação, conta e sistema. O tema padrão é escuro; o claro fica em `localStorage` (`maestro-qa-theme`) e é aplicado no `<head>` antes da primeira pintura, para o refresh não piscar o modo errado.

| Área | Página | Função |
| --- | --- | --- |
| Operação | Visão geral | Projeto ativo, prontidão, KPIs das execuções **reais** (fixture fica de fora). |
| Operação | Runs | Botões das suítes do catálogo, execução ao vivo, logs e evidências. |
| Operação | Histórico | Execuções do projeto ativo, JUnit e isolamento por `project_id`. |
| Conta | Projetos | Cadastro e lista. Configurações **não** cadastra projeto. |
| Sistema | Settings | Aparência, projeto/ambiente ativos, fluxos, execução e integrações. |
| Sistema | Documentação | Central de ajuda para humanos e agentes (`?help=<slug>`). |

**Primeiros passos** na Visão geral usa o estado real (projeto, ambiente, dispositivo, catálogo, primeira execução `script`). Com os cinco itens concluídos o card some da Visão geral; o checklist continua em Documentação → Primeiros passos.

**Cadastro de projeto:** nome, descrição opcional, tipo (`mobile`, `web`, `hybrid`) e diretório local absoluto. **Escolher pasta** chama `POST /api/projects/browse` e abre o seletor nativo **no host do dashboard** (Finder no macOS; no Linux, zenity/kdialog; no Windows, diálogo do sistema). O navegador não entrega caminho absoluto; por isso não use `<input type="file">`. Cancelar o diálogo não altera o campo. Digitar o path continua válido. O cadastro não dispara testes e não clona repositório. Path relativo, inexistente ou com metacaractere de shell responde `400`. Diretório já cadastrado responde `409`. Trocar o projeto ativo com suíte em andamento responde `409`.

Links de ajuda e atalhos de texto na interface usam a laranja da marca, com ícone.

## Testar um projeto Flutter

### 1. Preparar o app

Na raiz do app Flutter:

```text
meu-app/
  .maestro/flows/
    login/sign_in.yaml
    checkout/pay.yaml
```

Cada YAML de app começa com o `appId` instalado no dispositivo:

```yaml
appId: com.example.shop
---
- launchApp
```

Regras das pastas que viram suíte:

- Ficam direto em `.maestro/flows/`.
- O nome começa com letra minúscula e usa só `a-z`, `0-9`, `_` e `-`, com no máximo 41 caracteres.
- `all`, pastas com prefixo `_` e a pasta `templates` não viram suíte.
- Um YAML solto em `.maestro/flows/`, fora de subpasta, só entra na suíte `all`.

O id da suíte é o nome da pasta. No exemplo acima, as suítes são `all`, `login` e `checkout`. `all` executa `.maestro/flows` inteira.

Fora deste dashboard, deixe o app instalado e o dispositivo ligado. Exemplos, no repositório do app:

```bash
xcrun simctl list devices booted
flutter install -d <udid>

adb devices
flutter install -d <serial>
```

### 2. Subir o dashboard e cadastrar o app

```bash
cd <raiz-deste-repositório>
npm install
npm run dev
```

A interface fica em `http://127.0.0.1:4310`. Abra **Projetos**, informe o diretório absoluto (ou **Escolher pasta**) e cadastre sem executar testes. O seletor do topo passa a listar esse projeto. **Runs** lista os botões a partir do catálogo do projeto ativo. **Settings** mostra o app, o ambiente e o dispositivo efetivos.

Atalho de processo: `MAESTRO_REPO` absoluto válido sincroniza um projeto inicial no SQLite. Cadastrar pela interface **não** reescreve a variável de ambiente; o runner passa a usar o `repositoryPath` do projeto ativo. Trocar de projeto na UI não exige reiniciar o servidor. Um `MAESTRO_REPO` relativo, vazio ou com metacaractere de shell é ignorado.

`MAESTRO_APP_ID` é opcional quando algum YAML já declara `appId`. `MAESTRO_UDID` é opcional: sem ele, o dashboard usa o primeiro simulador iOS ligado e, se não houver, o primeiro Android em `adb devices`. `MAESTRO_API_URL` é opcional e só aceita HTTPS, sem usuário nem senha.

### 3. Conferir o alvo antes de executar

```bash
curl -sS http://127.0.0.1:4310/api/health
curl -sS http://127.0.0.1:4310/api/projects
curl -sS http://127.0.0.1:4310/api/prerequisites
curl -sS http://127.0.0.1:4310/api/catalog
```

Siga só se estes pontos baterem com o app pretendido:

- `activeProject.repositoryPath` é o diretório do app.
- `ready` é `true`.
- `driver` é `flows`.
- `projectName` é o nome configurado ou o nome da pasta do app.
- `appId` é o aplicativo instalado.
- `catalog.suites` contém `all` e as pastas descobertas.
- `catalog.error` é `null`.

`driver: "scripts"` significa que o repositório tem pelo menos um destes arquivos: `scripts/run_maestro_smoke.sh`, `run_maestro_stores.sh`, `run_maestro_coupons.sh`, `run_maestro_navigation.sh` ou `run_maestro_all.sh`. Nesse modo o dashboard executa só esses scripts e não descobre outras pastas. O nome, o `appId` e a API continuam vindo do ambiente ou dos YAML; não há aplicativo embutido.

### 4. Disparar uma suíte e julgar

Use um id presente em `catalog.suites`. Não invente o nome.

```bash
curl -sS -X POST http://127.0.0.1:4310/api/runs \
  -H 'content-type: application/json' \
  -d '{"suite":"login","mode":"script"}'
```

Guarde `run.id`. Consulte `GET /api/runs/{id}` até `status` deixar de ser `running`. O veredito está na seção [Como julgar](#como-julgar). O JUnit sanitizado, quando existir, sai em `GET /api/runs/{id}/report`.

No modo `flows`, o processo é `maestro test --format JUNIT --output .maestro/reports/<suíte>.xml .maestro/flows/<suíte>`. A suíte `all` recebe a pasta `.maestro/flows`. O dashboard copia o XML para `data/reports/{id}.xml`.

`mode: "fixture"` não testa o app. As quatro demonstrações reproduzem saídas gravadas e servem só para validar este dashboard.

## Contrato do agente

- Fale apenas com `127.0.0.1` ou `localhost`. Qualquer outro host, ou `X-Forwarded-For` fora de `127.0.0.1`/`::1`, responde `403`.
- Uma suíte por vez. `POST /api/runs` com outra execução ativa responde `409`.
- O corpo do `POST` aceita só `suite` e `mode`. Chave extra, JSON inválido ou corpo acima de 2000 caracteres responde `400` com `{ "error": "Pedido recusado." }`.
- Não existe execução de um YAML isolado. O catálogo lista fluxos; o start aceita só o id da suíte.
- `mode: "script"` roda o Maestro de verdade e exige pré-requisitos `ready: true`. `mode: "fixture"` reproduz uma saída gravada, grava SQLite e JUnit sanitizado, e não chama o Maestro nem o dispositivo.
- O texto do terminal é sinal. O veredito é `run.status` depois que deixa de ser `running`, junto com os cenários e, quando existir, o JUnit.
- Logs já saem sem ANSI, JWT, cookies e dados pessoais. Não peça o stdout bruto do processo.
- A captura de tela fica desligada enquanto uma suíte está em execução (`409`). Não use o Maestro MCP, a CLI nem outro portal no mesmo dispositivo durante essa execução.
- `POST /api/runs` não altera repositório, binário, UDID nem porta. O repositório efetivo é o do **projeto ativo** (`GET /api/projects`). `MAESTRO_BIN`, `MAESTRO_UDID`, `MAESTRO_APP_ID` e `DASHBOARD_PORT` continuam só no processo.
- Não invente rota de plugin. Não existe `/api/agents`. Documentação: `http://127.0.0.1:4310/?help=introducao`. Skill local: `.agents/skills/maestro-dashboard-qa/SKILL.md`.

## Subir o servidor

Na pasta deste repositório:

```bash
cd <raiz-deste-repositório>
npm install
npm test
npm run dev
```

O processo escuta só em `127.0.0.1`. A porta padrão é `4310`; `DASHBOARD_PORT` troca a porta, nunca o endereço. Confirme com `GET /api/health` antes de disparar suíte.

Produção local, em paralelo com o dev, usa outro diretório de build (`.next-prod` contra `.next`). Não suba os dois na mesma porta.

```bash
npm run build
npm start
```

`npm test` cobre parser, JUnit, sanitização, catálogo, cadastro de projeto, seletor de pasta (sem abrir o diálogo), tema e runner com saídas simuladas. Não inicia o Maestro nem o simulador.

## Ambiente do processo

| Variável | Padrão | Efeito |
| --- | --- | --- |
| `DASHBOARD_PORT` | `4310` | Porta local. Valor inválido volta para `4310`. |
| `DASHBOARD_IDLE_MINUTES` | `30` | Encerra o processo depois desse tempo sem suíte em execução. `0` desliga. |
| `MAESTRO_REPO` | nenhum | Se for caminho absoluto válido, vira (ou atualiza) um projeto no SQLite. O alvo em execução é o projeto ativo, cadastrado na UI ou por esta variável. |
| `MAESTRO_BIN` | `~/.maestro/bin/maestro` | Binário executável do Maestro. |
| `MAESTRO_UDID` | vazio | UUID do simulador iOS ou serial Android. Vazio: primeiro simulador iOS ligado ou o primeiro Android conectado. |
| `MAESTRO_APP_ID` | `appId` do YAML, ou `app` | Identificador do app instalado. Fora do formato `com.exemplo.app`, o valor é ignorado. |
| `MAESTRO_PROJECT_NAME` | nome da pasta | Nome exibido no dashboard. Até 80 caracteres. |
| `MAESTRO_API_URL` | nenhuma | HTTPS opcional, sem usuário nem senha. Vazio não consulta API e não bloqueia `ready`. |
| `MAESTRO_API_LABEL` | `API` | Rótulo da API na interface. |
| `MAESTRO_ENV_LABEL` | `dev` | Rótulo do ambiente na interface. |

## Procedimento

1. `GET /api/health`. Sem `{ "ok": true }`, o servidor não está no ar.
2. `GET /api/projects`. Sem `activeProject`, cadastre um diretório (`POST /api/projects`) ou suba com `MAESTRO_REPO` absoluto. Confira `activeProject.repositoryPath`.
3. `GET /api/prerequisites`. Para suíte real, `ready` precisa ser `true`. Checagens `required`: Maestro, os scripts ou os fluxos descobertos, e o dispositivo ligado. `hml` é `warning` e não bloqueia o start.
4. `GET /api/catalog`. Os ids executáveis estão em `suites`. Ignore fluxos com `suites: []`: estão fora da suíte completa.
5. `POST /api/runs` com um id de `catalog.suites`. Guarde `run.id`.
6. Consulte `GET /api/runs/{id}` até `run.status` deixar de ser `running`. Intervalo de alguns segundos. Suítes reais levam minutos.
7. Leia o resultado pela seção [Como julgar](#como-julgar). Se precisar do XML, `GET /api/runs/{id}/report`.
8. `POST /api/runs/{id}/stop` só quando a tarefa for interromper a execução ativa.

Se o start responder `409`, há suíte em andamento. Liste `GET /api/runs` e acompanhe a que está `running`. Não dispare outra. Se responder `412`, releia os pré-requisitos e reporte a checagem `required` com `ok: false`. Não repita o `script` até `ready` voltar a `true`.

O cache dos pré-requisitos dura 15 segundos.

## Suítes

Sem esses scripts, as suítes saem de `.maestro/flows` e aparecem em `catalog.suites`. A tabela abaixo vale só quando esses arquivos estão no repositório do **projeto ativo**.

| `suite` | Rótulo | Script | JUnit no app |
| --- | --- | --- | --- |
| `smoke` | Smoke | `scripts/run_maestro_smoke.sh` | `.maestro/reports/suite.xml` |
| `stores` | Lojas | `scripts/run_maestro_stores.sh` | `.maestro/reports/stores.xml` |
| `coupons` | Cupons | `scripts/run_maestro_coupons.sh` | `.maestro/reports/coupons.xml` |
| `navigation` | Navegação | `scripts/run_maestro_navigation.sh` | `.maestro/reports/navigation.xml` |
| `all` | Todos | `scripts/run_maestro_all.sh` | `.maestro/reports/all.xml` |

`suite` é obrigatório. `mode` omisso vale `script`. Um id fora de `catalog.suites` responde `400` no modo `script`.

## API

Base: `http://127.0.0.1:4310`. Respostas JSON levam `Cache-Control: no-store`. Erros de negócio são `{ "error": "<mensagem>" }`.

### `GET /api/health`

`200` `{ "ok": true, "service": "maestro-qa-dashboard" }`.

### `GET /api/projects`

`200` com o workspace: `projects`, `environments`, `activeProjectId`, `activeEnvironmentId`, `activeProject`, `activeEnvironment` e `discovery` (catálogo somente leitura do projeto ativo, ou `null`).

Sem projeto cadastrado, `projects` é `[]` e `activeProject` é `null`. Com projeto ativo, o histórico e o catálogo passam a ser desse diretório.

### `POST /api/projects`

Corpo só com `name`, `description`, `type` (`mobile` | `web` | `hybrid`) e `repositoryPath` (absoluto, existente, sem metacaractere de shell). `201` `{ "project", "workspace" }`. Não dispara suíte e não clona Git.

| Status | Quando |
| --- | --- |
| `400` | Path inválido, chave extra, JSON inválido ou corpo acima de 4000 caracteres. |
| `409` | Esse diretório já está cadastrado. |

### `POST /api/projects/browse`

Abre o seletor nativo de pasta **na máquina onde o dashboard está rodando**. `200` `{ "path": "/Users/…/app" | null, "cancelled": true|false }`. Use o `path` em `repositoryPath`. Não valida o diretório além do que o sistema devolveu; a validação ocorre no `POST /api/projects`.

`500` se o diálogo falhar. `501` se o SO não tiver seletor conhecido. Cancelar o diálogo não é erro.

### `POST /api/projects/{id}/select`

Ativa o projeto. Corpo opcional `{ "environmentId": "<uuid>" }`. `200` `{ "workspace" }`. `404` se o id não existe ou está desabilitado. `409` se há suíte `running`.

### `GET /api/projects/{id}/discover`

`200` `{ "discovery": { driver, appId, suites, modules, flowCount, error } }`. Somente leitura. `404` se o projeto não existe.

### `PATCH /api/projects/{id}`

Corpo só com `name`, `description`, `type`, `enabled`. Não troca `repositoryPath`. `200` `{ "project", "workspace" }`.

### `GET /api/prerequisites`

```json
{
  "ready": true,
  "checkedAt": "2026-01-01T00:00:00.000Z",
  "environment": "dev",
  "apiLabel": "API",
  "appId": "com.example.shop",
  "projectName": "meu-app",
  "driver": "flows",
  "simulatorUdid": "11111111-1111-4111-8111-111111111111",
  "simulatorName": "iPhone 16",
  "checks": [
    { "id": "maestro", "label": "Maestro CLI", "ok": true, "level": "required", "message": "..." },
    { "id": "scripts", "label": "Fluxos Maestro", "ok": true, "level": "required", "message": "..." },
    { "id": "simulator", "label": "Simulador", "ok": true, "level": "required", "message": "..." },
    { "id": "hml", "label": "API", "ok": true, "level": "warning", "message": "..." }
  ]
}
```

`ready` é verdadeiro só quando toda checagem `required` está `ok`. `driver` é `flows` ou `scripts`. `projectName` e `appId` dizem qual app o processo vai exercitar.

### `GET /api/catalog`

`{ "suites": [{ "id", "label" }], "modules": [{ "id", "label", "flows": [{ "name", "file", "module", "moduleLabel", "suites": [] }] }], "error": null }`.

`suites` é a lista que o `POST` aceita no modo `script`. `error` preenchido significa que `.maestro/flows` não está acessível; `modules` vem vazio. No modo `scripts`, isso pode acontecer sem impedir as suítes dos scripts. Módulos conhecidos ficam na ordem smoke, stores, coupons, navigation; os demais seguem em ordem alfabética.

### `GET /api/runs`

`{ "runs": [Run] }` com as últimas 40 execuções, da mais recente para a mais antiga. Com projeto ativo, só as daquele `project_id`. Sem projeto ativo, lista o que houver (incluindo execuções órfãs). `mode: "fixture"` aparece no histórico e não entra nos KPIs da Visão geral.

### `POST /api/runs`

```bash
curl -sS -X POST http://127.0.0.1:4310/api/runs \
  -H 'content-type: application/json' \
  -d '{"suite":"login","mode":"script"}'
```

`202` `{ "run": Run }`. A execução já está `running`.

| Status | Quando |
| --- | --- |
| `400` | Suíte ausente, id inválido, suíte que o projeto não tem, ou `mode` diferente de `script` e `fixture`. |
| `409` | Já existe suíte neste dispositivo. |
| `412` | Modo `script` com pré-requisito `required` indisponível. |
| `500` | Falha interna. A mensagem é genérica. |

Fixture de validação, sem Maestro. A suíte escolhe o exemplo gravado, e o resultado continua marcado como `mode: "fixture"`. Esses exemplos não dependem do app apontado por `MAESTRO_REPO`:

| Suíte | Exemplo |
| --- | --- |
| `smoke` | Um cenário reprovado. A falha do log e a do JUnit são o mesmo fluxo. |
| `stores` | Todos aprovados. |
| `coupons` | Falha de infraestrutura, sem JUnit e sem cenário reprovado. |
| `navigation` | Suíte sem testes. |
| `all` | Fluxos previstos aprovados. |

Enquanto `status` é `running`, o percentual de sucesso fica em aberto. `POST /api/runs/{id}/stop` produz a execução interrompida. Um log no meio da suíte é sinal provisório; o veredito só fecha no encerramento.

```bash
curl -sS -X POST http://127.0.0.1:4310/api/runs \
  -H 'content-type: application/json' \
  -d '{"suite":"smoke","mode":"fixture"}'
```

### `GET /api/runs/{id}`

`200` `{ "run": Run, "scenarios": [Scenario], "logs": [Log] }`. Até 1000 linhas de log. `404` se o id não existe.

Enquanto `run.status` é `running`, os cenários ainda mudam. Decida só depois do estado terminal.

### `POST /api/runs/{id}/stop`

`200` `{ "ok": true }`. Envia `SIGTERM` ao grupo do processo e, se continuar, `SIGKILL` após 2 segundos. O status final fica `aborted`.

| Status | Quando |
| --- | --- |
| `400` | Id que não é UUID. |
| `404` | Execução inexistente. |
| `409` | A execução existe e não está em andamento. |

### `GET /api/runs/{id}/report`

`200` com `Content-Type: application/xml` e o JUnit sanitizado copiado para `data/reports/{id}.xml`. `404` em JSON quando essa execução não tem relatório. O Maestro continua gravando o caminho fixo em `.maestro/reports/`; a cópia do dashboard não é sobrescrita pela execução seguinte.

### `GET /api/events`

SSE (`text/event-stream`). O primeiro evento é `type: "snapshot"` com `run`, `scenarios` e `logs` (até 400). Depois vêm `state` (mudança de cenário) e `log` (uma linha em `log`). Heartbeat `: ping` a cada 15 segundos. O canal é opcional. O polling de `GET /api/runs/{id}` é o caminho estável para decidir o resultado.

### `GET /api/simulator/screenshot`

`200` `image/png`. No iOS a captura usa `xcrun simctl io`; no Android, `adb exec-out screencap -p`. `409` se há suíte em execução. `503` se a captura falha. Não chame durante um `script`. A imagem é estática; não há vídeo.

## Como julgar

Estados da execução: `running`, `passed`, `failed`, `aborted`.

Estados do cenário: `pending`, `running`, `passed`, `failed`, `skipped`, `aborted`.

Uma execução terminou quando `status` não é `running`. Aí:

- `passed`: nenhum cenário `failed` e o processo saiu com código `0`. Se `errorMessage` disser que o JUnit está ausente, o processo passou sem relatório; diga isso em vez de tratar a suíte como confirmada pelo XML.
- `failed`: algum cenário `failed`, o código de saída é diferente de `0`, ou não há JUnit e o código de saída é `null`. Use `errorMessage` da execução e `errorMessage` de cada cenário `failed`.
- `aborted`: interrupção pedida ou processo órfão encerrado. `errorMessage` é `Execução interrompida.`

A taxa de sucesso é aprovados ÷ (aprovados + reprovados). Ignorados, interrompidos, pendentes e em execução entram no total e ficam fora da taxa. Enquanto a execução está `running` ou `aborted`, a taxa fica em aberto.

Campos úteis de `Run`: `id`, `projectId`, `suite`, `suiteLabel`, `mode`, `status`, `exitCode`, `durationMs`, `passedCount`, `failedCount`, `skippedCount`, `abortedCount`, `totalCount`, `errorMessage`, `junitPath`, `simulatorName`, `startedAt`, `finishedAt`.

Campos úteis de `Scenario`: `name`, `file`, `module`, `status`, `confirmed`, `errorMessage`, `durationMs`. `logSignal` é o que o parser viu no terminal antes do JUnit; não substitui `status` no fim.

`Log` traz `stream` (`stdout` ou `stderr`), `line`, `ts`, `scenarioName` e `command`. Serve para explicar uma falha, não para inventar o veredito.

Histórico em SQLite: `data/maestro-qa.sqlite` (`runs`, `scenarios`, `logs`, `qa_projects`, `qa_environments`, `qa_settings`). Execuções `fixture` ficam no histórico e não entram no resumo de execuções reais da Visão geral.

Documentação na UI: slugs `introducao`, `arquitetura`, `instalacao`, `primeiro-projeto`, `ambientes`, `descoberta-modulos`, `suites-autorizadas`, `executar-testes`, `monitoramento`, `evidencias`, `junit`, `historico`, `conectar-agente`, `skill-maestro-qa`, `seguranca`, `troubleshooting`, `resultados`. Abra com `?help=<slug>` ou o tópico `onboarding`.

## O que o runner faz

1. Resolve o repositório pelo projeto ativo (cadastro ou `MAESTRO_REPO` sincronizado). Com qualquer script `run_maestro_*.sh` conhecido, executa só esses scripts. Sem eles, descobre `.maestro/flows` e chama `maestro test`.
2. Confere o binário do Maestro, a permissão de execução dos scripts ou a existência dos fluxos, e se o dispositivo está disponível.
3. Consulta `MAESTRO_API_URL` sem credencial, quando houver URL. Falha de rede gera alerta e não bloqueia a execução. Sem URL, a checagem `hml` fica `ok` com o aviso de que nenhuma API foi configurada.
4. Inicia uma única suíte, com `MAESTRO_UDID` apontando para o dispositivo escolhido.
5. Publica stdout e stderr já sanitizados.
6. No fim, copia o XML gerado depois do início da execução, sanitiza e reconcilia os cenários. O estado final vem do JUnit ou, na ausência dele, do código de saída.
