---
name: dev-task
description: Conduz uma tarefa de desenvolvimento (feature ou bug) do entendimento ao código pronto para review, com plano aprovado, teste no Maestro e code review. Usar ao receber uma nova tarefa.
---

# Dev Task

Fluxo para levar uma tarefa do entendimento até o código pronto para review. Serve para qualquer stack: descubra na fase 1 os comandos do projeto (ex.: em Flutter, `flutter analyze` e `flutter test`) e use-os no lugar de "build/lint/testes".

Toda comunicação com o usuário e toda documentação gerada devem ser em português.

## Regras que valem para todas as fases

**Nunca invente.** Regra de negócio, contrato de endpoint, comportamento de tela ou nome de campo que não esteja na tarefa ou no código é uma pergunta para o usuário, não uma suposição. Pergunte assim que a dúvida surgir, em qualquer fase, e espere a resposta antes de avançar naquele ponto.

**Trava de git.** Nunca faça `git commit`, `git push`, criação de branch remota ou abertura de PR por conta própria. Essas ações só acontecem quando o usuário pedir explicitamente nesta conversa, e o pedido vale apenas para a ação pedida:
- aprovar o plano, os testes ou o review **não** é autorização para commitar;
- pedir commit **não** autoriza push; pedir push **não** autoriza PR;
- antes de executar, mostre o que será feito (arquivos, mensagem de commit, branch de destino) e confirme;
- nunca use `--force`, nunca commite direto na branch principal e nunca inclua arquivos temporários de teste;
- se não houve pedido, termine com as alterações apenas no working tree e avise.

**Portão do plano.** Não escreva código antes de o usuário aprovar o plano (fase 4).

**Papéis dos agentes.** O agente principal conduz a conversa, o plano e toda alteração de código. Subagentes só investigam, testam ou revisam e devolvem um relatório; nenhum subagente altera código do projeto, faz commit ou fala com o usuário.

## Quando a tarefa é um bug

O fluxo é o mesmo, com estas diferenças:

- **Fase 2:** em vez de critérios de aceite, registre comportamento atual, comportamento esperado e passos para reproduzir. Se faltar algum dos três, pergunte.
- **Fase 3:** reproduza o bug antes de qualquer coisa (no emulador/dispositivo ou por teste). Se não conseguir reproduzir, pare e avise. Depois encontre a causa raiz e verifique todos os pontos que usam o código defeituoso, não só o caminho citado na tarefa.
- **Fase 4:** o plano informa a causa raiz, a correção proposta, o que mais pode ser afetado e se há outros lugares com o mesmo defeito. Continua exigindo aprovação, mesmo para correção de uma linha.
- **Fase 5:** corrija na origem, com a menor alteração possível. Não aproveite para refatorar. Escreva um teste de regressão que falha sem a correção, salvo se for inviável (explique por quê).
- **Fase 6:** o primeiro cenário do Maestro é o passo a passo do bug, agora passando; os demais cobrem o fluxo ao redor.
- **Fase 8:** o guia de review traz causa raiz, correção e como confirmar que o bug não ocorre mais.

## Fase 1 — Contexto do projeto

1. Leia `CLAUDE.md` e/ou `AGENTS.md` (raiz e subpastas relevantes). Essas diretrizes têm prioridade sobre qualquer hábito seu.
2. Se nenhum existir, analise o projeto: stack e versões, estrutura de pastas, arquitetura e camadas, gerência de estado, navegação, camada de rede, convenções de nomes, testes existentes, lint/formatter e comandos de build.
3. Resuma em poucas linhas os padrões que a tarefa vai precisar respeitar.
4. Em projeto grande, você pode delegar essa varredura (e a da fase 3) a um subagente somente leitura. Peça de volta apenas um resumo curto e os caminhos dos arquivos relevantes; depois leia você mesmo os arquivos que a tarefa vai tocar.

## Fase 2 — Entender a tarefa

A descrição é colada no chat pelo usuário (normalmente vinda de um board, como o Azure Boards). Se não foi colada, peça.

1. Leia a descrição inteira e reescreva-a como critérios de aceite verificáveis.
2. Identifique se exige endpoints novos, alteração em endpoints existentes ou nenhuma mudança de API.
3. Telas: se houver link do Figma e as ferramentas do Figma estiverem disponíveis, leia o design por elas; senão, peça as imagens. Para cada tela analise componentes, estados (vazio, carregando, erro, sucesso), validações e navegação de entrada e saída. Reaproveite componentes que o projeto já tem.
4. Se a tarefa menciona tela mas não veio imagem nem link, pergunte antes de seguir.

## Fase 3 — Investigar o que já existe

1. Procure no código o que já existe no fluxo da tarefa: telas, componentes, serviços, modelos, rotas, testes.
2. Entenda como funciona hoje e informe o usuário quando isso afetar a tarefa (conflito, duplicação, código que será alterado, risco de regressão).
3. Para cada endpoint envolvido, classifique:
   - atende como está;
   - precisa de novos campos no retorno (mudança compatível);
   - precisa de nova versão (mudança que quebra clientes atuais);
   - precisa ser criado.
4. Se o backend não estiver neste repositório, não assuma o contrato: peça-o ao usuário ou registre como dependência no plano.

## Fase 4 — Planejamento (portão)

Apresente o plano e **aguarde aprovação explícita** antes de implementar. O plano deve conter:

- resumo do entendimento e critérios de aceite;
- fases ou tasks pequenas, em ordem, cada uma com arquivos afetados e como será verificada;
- mudanças de API (campos novos, versões, endpoints novos);
- testes unitários: diga se a tarefa precisa deles (lógica de negócio, cálculo, parsing, estado) ou não, e por quê;
- cenários previstos para o teste no Maestro;
- riscos, dependências e perguntas ainda abertas.

Se o usuário pedir ajustes, ou se surgir informação nova, volte às fases 2–3 e reapresente o plano.

## Fase 5 — Implementação

1. Execute uma task por vez, na ordem aprovada, acompanhando numa lista de tarefas.
2. Siga os padrões e a arquitetura existentes; não introduza biblioteca, padrão ou refatoração fora do escopo sem perguntar.
3. Escreva os testes unitários previstos no plano, no padrão do projeto. Esses ficam no repositório.
4. Ao fim de cada task rode build, lint e os testes existentes.
5. Se descobrir algo que invalida o plano, pare, explique e volte à fase 4. Não improvise.

## Fase 6 — Teste no Maestro (agente dedicado)

Delegue a um subagente de testes, passando os critérios de aceite e como rodar o app. Ele escreve os flows, executa e reporta; não corrige código do projeto. Os flows são **descartáveis**: servem para validar esta entrega e não entram no repositório. Esta fase não cria nem altera a suíte de regressão do app (`.maestro/flows/`) e não usa a skill maestro-dashboard-qa; manter a suíte é outro trabalho, feito só quando o usuário pedir.

1. Crie cenários a partir dos critérios de aceite: caminho feliz, validações, erros, estados vazios e regressão do fluxo que já existia.
2. Escreva os flows YAML e salve as capturas numa pasta temporária fora do versionamento (fora do repositório, ou numa pasta ignorada pelo git), nunca dentro de `.maestro/flows/`.
3. Verifique o ambiente antes: Maestro instalado e emulador ou dispositivo físico conectado. Se não houver, avise o usuário em vez de simular resultado.
4. Execute com `maestro test` e capture telas nos pontos-chave com `takeScreenshot`.
5. Falha de teste: o subagente reporta o cenário, o passo que falhou e a captura. Se o erro for do flow, ele mesmo ajusta e roda de novo; se for do app, o agente principal corrige e pede nova execução. Nunca relate como aprovado um cenário que não rodou.
6. Entregue uma tabela cenário → resultado.
7. **Somente se o usuário pedir evidências**, gere um PDF com: tarefa, data, dispositivo/versão, e para cada cenário os passos, o resultado e as capturas.
8. Ao final, apague a pasta temporária (mantendo o PDF, se foi gerado) e confirme com `git status` que nada de teste ficou no repositório.

## Fase 7 — Code review (agente com contexto zerado)

1. Abra um subagente novo, sem o histórico desta conversa. Passe apenas: a descrição da tarefa, os critérios de aceite, o diff das alterações e as diretrizes do projeto. Não passe suas justificativas nem o plano, para não induzir o review.
2. Use `/code-review` se estiver disponível; senão, peça ao subagente revisão de corretude, aderência à arquitetura, casos de borda, segurança, performance, legibilidade e cobertura de testes.
3. O revisor apenas aponta; quem corrige é o agente principal. Para cada apontamento: corrija, ou explique ao usuário por que não será aplicado. Itens que mudam escopo ou regra de negócio vão para decisão do usuário.
4. Depois de correções relevantes, rode novamente os testes.

## Fase 8 — Guia de review para o programador

Escreva um documento curto, em português, cujo único objetivo é facilitar o review humano do código. Não é documentação do produto e não entra no repositório, a menos que o usuário peça. Entregue no chat (ou como arquivo `.md` fora do versionamento):

- o que a tarefa pedia e o que foi feito, em poucas linhas;
- arquivos novos e alterados, agrupados por camada, com o que mudou em cada um;
- por onde começar a ler e qual é o fluxo principal;
- endpoints novos, campos adicionados e mudanças de versão;
- decisões tomadas e pontos que merecem atenção do revisor;
- como testar manualmente;
- resultado dos testes e apontamentos do review automático tratados ou pendentes.

## Encerramento

Informe que o código está pronto no working tree, sem commit. Pergunte se o usuário quer que você faça o commit, o push ou a PR — e só execute o que for pedido, seguindo a trava de git.
