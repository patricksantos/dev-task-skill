# dev-task

Skill para o Claude que conduz o desenvolvimento de uma tarefa (feature ou bug) do entendimento até o código pronto para review:

1. lê as diretrizes do projeto (`CLAUDE.md` / `AGENTS.md`);
2. entende a tarefa e pergunta o que estiver ambíguo;
3. investiga o que já existe no código e nos endpoints;
4. apresenta um plano e espera aprovação antes de escrever código;
5. implementa uma task por vez;
6. testa no emulador ou dispositivo com [Maestro](https://maestro.mobile.dev);
7. faz code review com um agente de contexto zerado;
8. entrega um guia de review para o programador.

A skill nunca faz commit, push ou PR sem pedido explícito.

## Instalação

### Claude Code

Para todos os seus projetos:

```bash
git clone https://github.com/patricksantos/dev-task-skill.git
mkdir -p ~/.claude/skills
cp -r dev-task-skill/dev-task ~/.claude/skills/
```

Para um projeto só (e para o time que clonar o repositório), copie a pasta `dev-task` para `.claude/skills/` dentro do projeto.

### Claude (web e desktop)

Compacte a pasta `dev-task` em um ZIP e envie em Customize > Skills > Create skill > Upload a skill.

## Uso

Cole a descrição da tarefa no chat e peça para usar a skill `dev-task` (no Claude Code: `/dev-task`). Se houver telas, anexe as imagens ou o link do Figma.

## Requisitos

- Maestro instalado e um emulador ou dispositivo conectado, para a fase de testes.
