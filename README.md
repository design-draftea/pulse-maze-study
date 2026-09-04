# Pulse

Protótipo mobile de prediction market de Bitcoin com rodadas contínuas de 15
minutos e decisões UP/DOWN. A interface usa espanhol do México e combina dados
públicos reais com uma contingência local invisível para manter os testes de
usuário operacionais.

## Stack

- React 19
- TypeScript 6
- Vite 8
- CSS
- pnpm

## Como executar

O scaffold foi validado com Node.js 24.

```bash
pnpm install
pnpm dev
```

O Vite informa a URL local disponível ao iniciar o servidor.

Scripts úteis:

```bash
pnpm dev      # servidor de desenvolvimento
pnpm build    # typecheck e build de produção
pnpm lint     # análise estática com Oxlint
pnpm preview  # preview local do build
pnpm test:chart
pnpm test:fallback
pnpm test:market
pnpm test:proxy
pnpm test:wallet
```

## Estado atual

- Interface mobile responsiva até `499px`, baseada no Figma do Pulse.
- Preço BTC em tempo real com Chainlink, Coinbase e Kraken em contingência.
- Rodadas, gráfico, histórico, compra, venda e carteira simulada persistente.
- Publicação preparada para GitHub Pages em `/pulse/`.
- Proxy mínimo da rota de preço objetivo preparado como Cloudflare Worker.

## Estrutura principal

```text
src/
  assets/       assets locais da interface
  components/   componentes visuais
  hooks/        coordenação da rodada, feeds e carteira
  services/     regras puras e integrações de dados
  styles/       tokens e estilos compartilhados
infra/
  polymarket-proxy/  Cloudflare Worker sem credenciais de produto
tests/               testes do gráfico, mercado, proxy e carteira
```

## Publicação

O workflow `Deploy Pulse to GitHub Pages` testa, compila e publica a pasta
`dist` com o caminho-base `/pulse/`.

A rota da Polymarket que fornece o preço objetivo não aceita acesso direto do
navegador. O Worker em `infra/polymarket-proxy` encaminha somente consultas BTC
válidas de 15 minutos. As instruções de configuração estão em
[`infra/polymarket-proxy/README.md`](infra/polymarket-proxy/README.md).

Sem a variável `PULSE_POLYMARKET_PROXY_ORIGIN`, o build continua funcional com
a contingência silenciosa já existente, mas não recebe o preço objetivo oficial
da Polymarket.

## Colaboração

- [AGENTS.md](AGENTS.md): regras compartilhadas de trabalho.
- [CLAUDE.md](CLAUDE.md): entrada de contexto para o Claude Code.
- [docs/AI_CONTEXT.md](docs/AI_CONTEXT.md): contexto durável do produto e da arquitetura.
- [docs/AI_HANDOFF.md](docs/AI_HANDOFF.md): estado operacional da tarefa atual.

Cada mudança deve ser desenvolvida em uma branch própria. Pull Request, merge e
deploy são etapas separadas.
