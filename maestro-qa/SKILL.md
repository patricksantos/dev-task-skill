---
name: maestro-qa
description: Cria e mantém a suíte E2E de um app Flutter ou site com o Maestro MCP e o Maestro QA Dashboard. Usar quando pedirem para criar ou manter a suíte. Não serve para validar uma tarefa da dev-task.
---

# Testes E2E com Maestro e o Painel QA

Use esta skill só quando o usuário pedir para criar, manter ou executar a suíte de regressão do app. Ela não faz parte da skill dev-task: os testes da fase 6 da dev-task usam flows descartáveis e não passam por aqui.

Siga o ciclo: entender o app, inspecionar a tela, gravar o YAML, validar o fluxo e, quando a suíte existir, executá-la pelo dashboard. As rotas, as variáveis e o julgamento do resultado estão descritos abaixo. Para qualquer outra rota, consulte o `README.md` do dashboard (seção 0). Não invente rotas.

O dashboard não compila nem instala o Flutter. Sem um `MAESTRO_REPO` absoluto, nenhum app é selecionado. Confirme `projectName`, `appId` e `driver` antes de uma execução real. Não controle o mesmo dispositivo ao mesmo tempo por MCP, CLI e dashboard.

## 0. Encontrar e preparar o dashboard

O Maestro QA Dashboard é o apoio desta skill: ele executa as suítes, guarda o histórico e entrega o JUnit. Ele vem dentro da pasta desta skill, em `maestro-qa-dashboard/` (https://github.com/patricksantos/my-trainee-dev). O `README.md` do dashboard é a referência completa: veja as seções "Contrato do agente", "API" e "Como julgar".

1. Use o dashboard em `${CLAUDE_SKILL_DIR}/maestro-qa-dashboard`. Se a pasta não existir (por exemplo, se só o `SKILL.md` foi copiado), pergunte ao usuário onde o dashboard está.
2. Se o usuário não tiver o dashboard, peça autorização e clone o repositório numa pasta fora do app testado:

```bash
git clone --depth 1 https://github.com/patricksantos/my-trainee-dev.git <pasta>
```

O dashboard fica em `<pasta>/maestro-qa/maestro-qa-dashboard`.

3. Na pasta do dashboard, confira se o Node é 22.13 ou mais novo (`node --version`), porque o banco usa `node:sqlite`. Na primeira vez, rode `npm install`. `npm test` valida o próprio dashboard sem usar o Maestro nem o dispositivo.
4. Antes de subir, veja se já há um dashboard no ar: se `GET /api/health` responder `{ "ok": true }`, confira em `/api/prerequisites` se ele aponta para o app pedido. Se apontar para outro app, peça ao usuário para reiniciá-lo; não encerre o processo por conta própria.

## 1. Apontar o dashboard ao app

1. Confirme que o app de debug está instalado no simulador ou emulador e que os fluxos estão em `.maestro/flows/<suíte>/*.yaml`, com `appId`. O nome da pasta vira o id da suíte: letra minúscula inicial, só `a-z`, `0-9`, `_` e `-`, até 41 caracteres. Pastas `_`, `templates` e `all` não viram suíte. YAML solto em `.maestro/flows/` só entra em `all`.
2. Suba o dashboard com o caminho absoluto do app, em segundo plano. O dashboard se encerra sozinho depois de 30 minutos sem suíte em execução (`DASHBOARD_IDLE_MINUTES` muda o tempo; `0` desliga). Ao terminar, avise o usuário disso. Variável ausente, relativa ou com metacaractere de shell não seleciona app nenhum. Trocar o alvo exige reiniciar o processo.

```bash
cd <pasta-do-dashboard>   # ex.: ${CLAUDE_SKILL_DIR}/maestro-qa-dashboard
MAESTRO_REPO=/caminho/absoluto/do-app \
MAESTRO_PROJECT_NAME="Nome do app" \
MAESTRO_APP_ID=com.exemplo.app \
npm run dev
```

`MAESTRO_APP_ID` é opcional quando o YAML já declara `appId`. `MAESTRO_UDID` é opcional. `MAESTRO_API_URL`, se usada, é HTTPS sem usuário nem senha.

3. Leia o estado local antes de disparar:

```bash
curl -sS http://127.0.0.1:4310/api/health
curl -sS http://127.0.0.1:4310/api/prerequisites
curl -sS http://127.0.0.1:4310/api/catalog
```

Pare se `ready` não for `true`, se `projectName` ou `appId` não forem o app pedido, ou se `catalog.error` impedir a suíte. `driver: "flows"` descobre `.maestro/flows`. `driver: "scripts"` executa só os `scripts/run_maestro_*.sh` conhecidos e não descobre outras pastas. Os ids válidos estão em `catalog.suites`.

4. Na interface, a página Execuções mostra esses botões e Configurações mostra o app efetivo. A porta padrão é `4310`; outro host ou `X-Forwarded-For` fora de localhost responde `403`.

## 2. Entender o alvo e as ferramentas

1. Procure no app arquivos de instrução para agentes: `CLAUDE.md` e `AGENTS.md`, na raiz e em `.claude/`. Se existirem, leia antes de tudo e siga o que disserem sobre ambientes, contas de teste, convenções de testes e comandos, desde que não contrariem as regras de segurança desta skill (seção 6).
2. Leia o README do app e o do dashboard. Identifique ambiente, `appId`, suíte e limites. `dev`, localhost ou uma resposta HTTP não tornam o alvo seguro.
3. Para Maestro MCP local, use `list_devices` antes de `inspect_screen`, `take_screenshot` ou `run`. Use só um `device_id` retornado. Em site, use o dispositivo Chromium retornado.
4. Antes de um comando Maestro pouco familiar, consulte `cheat_sheet`. Para resultado de suíte, use a interface ou as rotas GET da seção 5. Não envie credenciais.

## 3. Explorar com o Maestro MCP

1. Inspecione a tela atual. Capture screenshot só quando a imagem ajudar. Reinspecione depois de cada mudança relevante.
2. Copie o texto da hierarquia. `accessibilityText` pode orientar um seletor `text:`, mas não é a chave. Prefira id estável; sem id, use o texto completo observado. Não copie refs temporários para o YAML.
3. Não faça login, compra, transação, alteração de conta ou ação destrutiva sem autorização explícita e dados de teste.

## 4. Escrever e validar o YAML

1. Grave o fluxo em `.maestro/flows/<suíte>/` do app, com o `appId` confirmado. Site usa `url` e `openLink`. Inclua só seletores observados e asserts do estado esperado. Preserve YAML já aprovado.
2. Valide com `run`: exatamente um entre YAML inline, lista de arquivos ou diretório, mais `device_id`.
3. Se falhar, corrija a primeira causa demonstrada e execute de novo. Validação sintática não aprova o fluxo.

Enquanto essa exploração usa o dispositivo, não dispare suíte no dashboard.

## 5. Executar a suíte no dashboard

1. Use o dashboard quando a suíte já puder rodar inteira. Antes, confira `GET /api/health`: se o dashboard tiver se encerrado por inatividade, suba de novo como na seção 1. Confirme ambiente não produtivo, dispositivo ligado, app instalado e nenhuma execução ativa.
2. O modo real é `script`. `fixture` reproduz saídas gravadas e não testa o app apontado por `MAESTRO_REPO`.
3. Envie só `suite` e `mode`. O id precisa estar em `catalog.suites`.

```bash
curl -sS -X POST http://127.0.0.1:4310/api/runs \
  -H 'content-type: application/json' \
  -d '{"suite":"<id>","mode":"script"}'
```

4. Guarde `run.id`. Consulte `GET /api/runs/{id}` até `status` deixar de ser `running`. `202` inicia; `400` recusa a suíte; `409` já existe execução; `412` falta pré-requisito `required`. Não repita o `script` enquanto `ready` for falso.
5. Julgue pelo status final, pelos cenários e pelo JUnit em `GET /api/runs/{id}/report`. `COMPLETED` ou `[Passed]` no log são sinal provisório. Sem JUnit, diga isso. A taxa é aprovados ÷ (aprovados + reprovados).
6. Durante a suíte, não chame screenshot (`409`), nem use MCP, CLI ou outro portal no mesmo dispositivo. `POST /api/runs/{id}/stop` só para interromper de propósito.

## 6. Pré-requisitos e segurança

`ready` cobre Maestro, fluxos ou scripts, e dispositivo. A checagem `hml` é alerta: uma resposta HTTP, inclusive `200`, `403` ou `404`, não prova VPN nem ambiente seguro. Sem `MAESTRO_API_URL`, essa checagem não bloqueia.

- Não altere endpoints, feature flags, dados, credenciais armazenadas (Keychain, Keystore) ou configuração para fazer o teste passar.
- Não encerre processos, reinicie ou apague simuladores, nem limpe dados sem autorização explícita.
- Não use credenciais pessoais, nem execute compras, transações ou mudanças cadastrais.
- Não faça operações Git de escrita, não publique e não crie commits.

## 7. Relatar o resultado

Informe `projectName`, `appId`, `driver`, ambiente, dispositivo, suíte, resultado final por cenário, duração, código de saída e presença ou ausência do JUnit. Separe execução `script` de `fixture`. Cite o log sanitizado e liste falhas, cenários não executados e bloqueios. Não declare o app aprovado sem uma execução real concluída.
