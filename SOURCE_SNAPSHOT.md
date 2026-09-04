# Snapshot da fonte

| Campo | Valor |
|---|---|
| Repositório fonte | `design-draftea/pulse` |
| Branch fonte | `main` |
| SHA | `a29313075fbafb6d5a1de76e818a1ae780a15acb` |
| Data e hora da cópia | 2026-09-04 20:22 UTC |
| Responsável pela cópia | design-draftea (tiago.ramon@draftea.com) |
| Repositório de destino | `design-draftea/pulse-maze-study` (privado, sem relação de fork) |
| Branch de implementação | `research/maze-v1` |
| Versão do estudo | `maze-v1` |

O working tree do repositório fonte estava limpo no momento da cópia, e a `main`
local coincidia com `origin/main`. O histórico Git foi preservado: este
repositório contém todos os commits do Pulse até o SHA acima, e o trabalho do
estudo começa depois dele.

## Regra de sincronização

Unidirecional. Melhorias do Pulse principal podem ser trazidas manualmente para
esta cópia. Nada daqui volta para lá por merge, cherry-pick ou pull request. O
remote `upstream-readonly` existe para leitura e tem o push desabilitado.

## Mudanças específicas do estudo

### Adicionado

- `src/study/` — camada de dados da pesquisa: tipos, configuração, cenários por
  tarefa, relógio virtual, série determinística do gráfico, histórico fixo,
  mercado simulado, armazenamento isolado, instrumentação de URL para o Maze,
  sobreposição de conteúdo e painel de diagnóstico.
- `RESEARCH_ONLY.md`, `SOURCE_SNAPSHOT.md`, `docs/MAZE_SETUP.md`,
  `docs/MAZE_STUDY_PLAN_PTBR.md`.
- `maze/snippet.html` — área reservada ao snippet oficial, vazia no repositório.
- Suítes `tests/studyScenarios`, `tests/studyMath`, `tests/studyMazeNavigation`,
  `tests/studyStorage`, `tests/studyIsolation`, `tests/helpAssistantStudy`.

### Removido

- `src/hooks/useBtcMarketRound.ts` e `src/hooks/useBtcPriceFeeds.ts` — WebSockets
  de Chainlink, Coinbase e Kraken.
- `src/hooks/useResilientBtcMarketRound.ts` — orquestração resiliente das fontes.
- `src/hooks/useOutcomeMarket.ts` — Gamma API e CLOB da Polymarket.
- `src/services/marketFallback.ts` — contingência ligada às fontes externas.
- `infra/polymarket-proxy/` — Cloudflare Worker de proxy.
- `.github/workflows/deploy-market-proxy.yml` — deploy do Worker.
- `tests/marketFallback.test.ts` e `tests/polymarketProxy.test.mjs`.
- Rota de preço da Polymarket, backfill de candles da Coinbase e a variável
  `VITE_POLYMARKET_PROXY_ORIGIN` em `src/services/marketData.ts` e
  `vite.config.ts`.
- Atalhos de demonstração e de injeção de falha em `src/App.tsx`.

### Alterado

- `src/App.tsx` consome `useStudyMarketRound` e `useStudyOutcomeMarket` no lugar
  dos hooks de mercado, e marca os marcos do Maze nos eventos reais da interface.
- `src/main.tsx` prepara o cenário antes do primeiro render e mostra a tela de
  link inválido quando não há `task`.
- `src/services/prototypeWallet.ts` grava sob `pulse.maze.v1.wallet`; as chaves do
  Pulse principal não são lidas nem apagadas.
- `src/hooks/useOnboardingInvite.ts` passa a obedecer ao cenário da tarefa.
- `src/components/entryFeedCadence.ts` troca `Math.random()` por um gerador com
  semente.
- O mercado do estudo caminha: o preço do Bitcoin é uma soma de senoides de
  períodos não harmônicos ancorada em US$80.012,40 na abertura, e UP e DOWN são
  derivados dele e arredondados para centavos inteiros. Determinístico por ser
  função do tempo decorrido, e não constante — decisão da pessoa responsável pela
  pesquisa, com a contrapartida de que os montos variam por participante e as
  perguntas do Maze não podem citá-los.
- `src/content/help/es-MX/helpContent.ts` aplica a sobreposição do estudo nas três
  frases que afirmavam que os dados vêm de fontes de mercado.
- `src/services/helpAssistant.ts` e `helpAssistantLive.ts` roteiam a pergunta
  sobre divergência de preço entre plataformas para o FAQ `price-difference`.
- `index.html`, `package.json` e o workflow de deploy assumem a identidade do
  estudo.
