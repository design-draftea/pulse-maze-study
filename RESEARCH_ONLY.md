# RESEARCH ONLY

Este repositório é uma cópia independente do Draftea Pulse para testes no Maze.
Todos os preços, saldos e resultados são simulados.
Este código não deve ser usado em produção nem enviado de volta ao repositório principal.
Fonte do snapshot: design-draftea/pulse@a29313075fbafb6d5a1de76e818a1ae780a15acb

## O que este repositório é

Uma versão congelável do protótipo Pulse, preparada para um teste de usabilidade
não moderado. A experiência visual é a mesma; a origem dos dados não é. Nenhuma
tela consulta Polymarket, Chainlink, Coinbase, Kraken, Gamma, CLOB ou qualquer
outro serviço de mercado. Compra, venda, saldo, histórico, preço, gráfico,
probabilidades e resultados vêm de `src/study/`.

## O que este repositório não é

- Não é base de produção.
- Não é fork do Pulse no GitHub. É um repositório novo, privado, com o histórico
  Git preservado a partir do snapshot acima.
- Não recebe pull request vindo do Pulse principal, nem envia um para lá.

## Regra de fluxo

O fluxo é unidirecional. Melhorias do Pulse principal podem ser trazidas para cá
manualmente. Código daqui nunca volta para lá. Os aprendizados da pesquisa
retornam ao produto como decisões, requisitos e tickets — a implementação é
refeita no repositório principal, em uma tarefa separada.

O remote `upstream-readonly` aponta para o Pulse principal apenas para leitura e
tem o push desabilitado:

```bash
git remote -v
# origin             git@github.com:design-draftea/pulse-maze-study.git (fetch)
# origin             git@github.com:design-draftea/pulse-maze-study.git (push)
# upstream-readonly  git@github.com:design-draftea/pulse.git (fetch)
# upstream-readonly  no_push (push)
```

## Por que ele permanece privado

O repositório contém o protótipo completo de um produto que ainda não foi
lançado. A ausência de permissão para configurar DNS, hospedagem ou o snippet do
Maze não autoriza torná-lo público como atalho de deploy. Quando o GitHub Pages
privado não estiver disponível no plano, o artefato estático é gerado e a
hospedagem aprovada é solicitada — nunca substituída por publicação aberta.

## Como reconhecer que você está no repositório de pesquisa

- `package.json` → `"name": "pulse-maze-study"`
- `index.html` → `data-study-version="maze-v1"` e `data-study-only="true"`
- Título do documento → `Draftea Pulse | Estudio de usabilidad`
- Armazenamento local sob o prefixo `pulse.maze.v1`
- Uma URL sem `?task=` válido não abre a Home: mostra a tela de link inválido.
