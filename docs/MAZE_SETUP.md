# Configuração do estudo no Maze

Documento operacional da coleta. Versão do protótipo: `maze-v1`.

## 1. Objetivo de cada Website Test block

O estudo tem quatro blocos de Website Test independentes. Cada um abre a sua
própria URL e termina no próprio marco de sucesso. Nenhum bloco depende do
anterior: um participante que abandone a tarefa 2 ainda chega à tarefa 3 com o
cenário certo.

| Tarefa | O que o bloco mede | URL inicial | Sucesso |
|---|---|---|---|
| Onboarding | Se a pessoa encontra o guia e o percorre até o fim | `?task=onboarding&mazeStep=start` | `mazeStep=onboarding-complete` |
| Compra | Se a pessoa consegue fazer uma entrada de US$10 em UP | `?task=buy&mazeStep=start` | `mazeStep=purchase-complete` |
| Venda | Se a pessoa encontra Entradas e vende a posição inteira | `?task=sell&mazeStep=start` | `mazeStep=sale-complete` |
| Ajuda | Se a pessoa acha a resposta sobre divergência de preço | `?task=help&mazeStep=start` | `mazeStep=answer-shown` |

## 2. URLs completas

Substitua o domínio pelo endereço efetivamente publicado (ver seção 12).

```text
https://pulse-maze.draftea.com/?task=onboarding&mazeStep=start
https://pulse-maze.draftea.com/?task=buy&mazeStep=start
https://pulse-maze.draftea.com/?task=sell&mazeStep=start
https://pulse-maze.draftea.com/?task=help&mazeStep=start
```

Uma URL sem `task` válido não abre a Home: mostra a tela
`Este enlace de prueba no es válido.` Isso é proposital — um link quebrado
produziria uma sessão com o cenário de outra tarefa, e essa resposta entraria na
análise sem que ninguém percebesse.

## 3. Caminhos esperados e marcos intermediários

Configure os marcos de sucesso pela URL. Os intermediários não validam a missão;
eles existem para ler o caminho percorrido.

### Onboarding

```text
?task=onboarding&mazeStep=start
?task=onboarding&mazeStep=onboarding-open
?task=onboarding&mazeStep=onboarding-complete
```

Caminho esperado: tocar no convite pulsante do `SubHeader` → percorrer os quatro
passos → `Entendido, empezar`.

Caminho alternativo aceitável: avançar e voltar entre os passos antes do CTA.

**Fechar o sheet no X ou arrastando não marca sucesso.** Abrir o guia não é o
mesmo que entendê-lo, e a tarefa pede a segunda coisa.

### Compra

```text
?task=buy&mazeStep=start
?task=buy&mazeStep=buy-betslip-open
?task=buy&mazeStep=purchase-complete
```

Caminho esperado: tocar em UP na Home → digitar `10` → deslizar para confirmar.

Caminhos alternativos aceitáveis: usar um dos montos rápidos e depois editar;
abrir o betslip em DOWN, voltar e trocar para UP; recolher e reabrir o betslip.

### Venda

```text
?task=sell&mazeStep=start
?task=sell&mazeStep=entries-open#entradas
?task=sell&mazeStep=sell-betslip-open#entradas
?task=sell&mazeStep=sale-complete#entradas
```

Caminho esperado: Home → `Entradas` na Navbar → `Vender` no card → deslizar.

Caminho alternativo aceitável: chegar a `Entradas` pelo card de entradas abertas
da própria Home, ou pelo menu de perfil.

A tarefa começa na Home de propósito: encontrar `Entradas` é parte do que se
mede, então o link nunca entrega a seção já aberta.

### Ajuda

```text
?task=help&mazeStep=start
?task=help&mazeStep=assistant-open
?task=help&mazeStep=answer-shown
```

Caminho esperado: qualquer entrada do `Pregúntale a Pulse` → escrever a pergunta
→ ler a resposta.

Caminhos alternativos aceitáveis: entrar pelo link da Home, pelo grupo `SOPORTE`
do menu de perfil ou pelo card central do `Centro de ayuda` — os três marcam
`assistant-open`.

`answer-shown` é marcado quando a resposta apoiada no FAQ `price-difference`
aparece na conversa, e não no envio da pergunta: a pessoa só encontrou o que
procurava quando o texto está na tela.

## 4. Como o `mazeStep` é atualizado

`markMazeStep` reescreve a URL com `history.replaceState`, preservando `task` e o
hash da navegação interna. A escolha por `replaceState` em vez de `pushState` é
deliberada: a aplicação já navega por hash e por `pushState`, e empilhar uma
entrada por marco faria o botão voltar exigir vários toques no meio da missão.

Consequência prática: **o Maze precisa detectar mudança de query parameter na
mesma página, sem recarregamento.** É o item mais importante do piloto (seção
11). Se o piloto mostrar que o bloco não fecha, veja a seção 13.

Nenhum identificador de participante, timestamp ou valor de carteira entra na
URL. Dois participantes no mesmo ponto da mesma tarefa produzem exatamente a
mesma URL, que é o que permite ao Maze agrupar os caminhos.

## 5. Snippet do Maze

**Situação atual: pendente.** O snippet oficial ainda não foi fornecido pela
equipe. Toda a instrumentação de URL está pronta e testada; falta apenas o
código de tracking.

O snippet é único por conta do Maze. Não invente ID, endpoint ou código: o Maze
só reconhece o snippet da própria conta.

### Onde inserir

1. Copie o snippet exatamente como o Maze o entrega.
2. Cole em `maze/snippet.html`, substituindo o comentário que está lá.
3. Não edite ID, endpoint nem a ordem das linhas.

Como alternativa ao arquivo, defina a variável de repositório
`PULSE_MAZE_SNIPPET` no GitHub (Settings → Secrets and variables → Actions →
Variables). O workflow escreve o conteúdo em `maze/snippet.html` antes do build.

### Como o snippet entra no build

`vite.config.ts` tem o plugin `mazeSnippet`, que substitui o marcador
`MAZE_SNIPPET` do `index.html` pelo conteúdo do arquivo — mas **somente** quando
`VITE_MAZE_ENABLED=true`. Sem essa variável o marcador é removido e nada externo
entra no bundle, que é o comportamento do build local e da verificação de pull
request. Se a variável estiver ativa e o arquivo vazio, o build falha de
propósito: nenhuma coleta deve subir sem instrumentação.

```bash
VITE_MAZE_ENABLED=true VITE_BASE_PATH=/pulse-maze-study/ pnpm build
```

### Como confirmar que ele carregou

Nas quatro URLs, com o DevTools aberto:

1. `view-source:` da página contém o snippet no `<head>`.
2. Aba Network mostra a requisição do script do Maze com status 200.
3. Console não registra erro de CSP nem de bloqueio.
4. `document.documentElement.dataset.studyVersion === 'maze-v1'`.

## 6. Instruções de publicação

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm test         # todas as suítes, incluindo test:study
VITE_BASE_PATH=/pulse-maze-study/ VITE_MAZE_ENABLED=true pnpm build
pnpm test:study   # a auditoria de bundle roda contra o dist recém-gerado
```

O workflow `Deploy Pulse Maze Study` faz exatamente isso a cada push na `main`,
e roda `pnpm test:study` **depois** do build, para reprovar um deploy que
reintroduza qualquer endpoint de mercado.

O deploy usa GitHub Pages a partir de um repositório privado. Caso o plano da
organização não permita Pages privado, o artefato estático continua sendo gerado
pelo workflow e precisa de uma hospedagem aprovada. **O repositório não deve ser
tornado público como solução de deploy.**

## 7. Configuração de dispositivo móvel

O protótipo é exclusivamente mobile. A partir de `500px` de largura ele cobre o
conteúdo com o aviso `MobileOnly`, então o estudo precisa rodar em celular.

- No Maze, marque os quatro blocos como **mobile only**.
- Larguras validadas: 320×568, 375×812, 390×844, 430×932 e 499×900.
- O zoom por pinça e por duplo toque está desabilitado em todo o protótipo.
- O campo do assistente usa `16px` para não disparar o zoom automático do Safari.

## 8. Orientação de privacidade

- A entrada livre do assistente carrega `data-maze-mask="True"`. O Maze mascara o
  conteúdo digitado na gravação: a análise vê que houve uma pergunta, sem guardar
  o texto dela.
- Nenhum dado pessoal entra na URL.
- Não há login, pagamento, depósito ou saque. Saldo e operações são simulados.
- O bloco de consentimento do estudo está em
  [MAZE_STUDY_PLAN_PTBR.md](MAZE_STUDY_PLAN_PTBR.md).

## 9. Versão e tag do protótipo

- Versão do estudo: `maze-v1`, exposta em `data-study-version` no elemento raiz,
  em `dist/STUDY_VERSION` e no painel de diagnóstico.
- Tag de coleta: `maze-v1.0.0`, criada no commit efetivamente publicado.
- Qualquer correção posterior à tag gera uma versão nova (`maze-v1.0.1`), com
  registro do que mudou e de quais participantes receberam cada versão.

## 10. Ferramentas de QA

Parâmetros que **não** entram nas URLs entregues aos participantes:

| Parâmetro | Efeito |
|---|---|
| `?debugStudy=1` | Mostra o painel de diagnóstico com tarefa, cenário, `mazeStep`, saldo, posição, preços e um botão de reset. |
| `?resetStudy=1` | Apaga o namespace `pulse.maze.v1` e recarrega o cenário. Sai da URL por `replaceState` depois de usado. |

O reset toca somente as chaves do estudo. `localStorage.clear()` não é usado em
lugar nenhum: um participante pode ter outra aba aberta no mesmo aparelho.

## 11. Procedimento de piloto

Antes de abrir a coleta, com duas ou três pessoas internas, em celular real:

1. Abrir cada uma das quatro URLs e confirmar que o cenário certo carrega
   (saldo, entradas, convite de onboarding, UP em 67%).
2. Percorrer cada tarefa até o marco de sucesso.
3. **Confirmar no Maze que os quatro blocos fecharam sozinhos.** Este é o teste
   que valida a detecção de query parameter descrita na seção 4.
4. Conferir na aba Network que nenhuma requisição sai para serviço de mercado.
5. Reabrir a mesma URL e confirmar que o cenário voltou ao estado inicial.
6. Conferir que a tarefa seguinte não herdou saldo nem entradas da anterior.
7. Confirmar que o campo do assistente aparece mascarado na gravação.

Se algum bloco não fechar, corrija antes de convidar participantes: sessões
coletadas com instrumentação quebrada não são recuperáveis depois.

## 12. Como trocar o domínio temporário pelo definitivo

Enquanto `pulse-maze.draftea.com` não estiver disponível, publique no endereço
temporário do GitHub Pages e ajuste o base path:

```text
https://design-draftea.github.io/pulse-maze-study/?task=onboarding&mazeStep=start
```

Para migrar ao domínio final:

1. Criar o registro DNS `CNAME` de `pulse-maze.draftea.com` para
   `design-draftea.github.io`.
2. Em Settings → Pages, definir o custom domain e aguardar o certificado.
3. Confirmar HTTPS e a ausência de conteúdo misto.
4. Trocar `PULSE_MAZE_BASE_PATH` para `/` nas variáveis do repositório e refazer
   o deploy.
5. Confirmar as quatro URLs no domínio final, com query parameters e hash.
6. Atualizar as URLs nos quatro blocos do Maze e nesta seção.
7. Refazer o piloto no link final.
8. Criar a tag `maze-v1.0.0` no commit publicado e congelar o deploy durante a
   coleta.

## 13. Como verificar se o Maze está detectando as mudanças de query parameter

1. Abrir a URL da tarefa dentro do preview do Maze.
2. Executar a ação que marca o passo (por exemplo, abrir o betslip de compra).
3. Confirmar na barra de endereço que o `mazeStep` mudou sem recarregar a página.
4. Concluir a tarefa e confirmar que o bloco fecha sozinho ao alcançar o marco de
   sucesso.

Se o bloco não fechar, o Maze não está observando `replaceState`. Nesse caso,
duas saídas, nesta ordem de preferência:

- Configurar o bloco para aceitar a URL de sucesso como *contains*, e não como
  correspondência exata.
- Trocar `replaceState` por `pushState` em `markMazeStep`
  (`src/study/studyMazeNavigation.ts`), aceitando que o botão voltar passe a
  percorrer os marcos. A troca é de uma linha e está isolada nessa função.

Registre qual das duas foi usada, porque ela muda o comportamento do botão
voltar durante a coleta.
