# Estudo no Maze — requisitos técnicos

> **Este documento é uma especificação, não a descrição de algo que já funciona.**
>
> Nada do que está aqui está implementado neste repositório. Ele registra as URLs
> que a coleta vai precisar, o comportamento que cada uma tem de ter e as
> decisões que ainda dependem de alguém. As perguntas do estudo estão em
> [MAZE_STUDY_PLAN_PTBR.md](MAZE_STUDY_PLAN_PTBR.md).

## 1. As quatro URLs

O estudo tem quatro blocos de Website Test independentes. Cada um abre a sua
própria URL e termina no próprio marco de sucesso.

```text
https://pulse-maze.draftea.com/?task=onboarding&mazeStep=start
https://pulse-maze.draftea.com/?task=buy&mazeStep=start
https://pulse-maze.draftea.com/?task=sell&mazeStep=start
https://pulse-maze.draftea.com/?task=help&mazeStep=start
```

O domínio é o destino desejado. Enquanto ele não existir, o endereço temporário
aprovado entra no lugar e esta seção é atualizada.

| Tarefa | O que o bloco mede | URL inicial | Sucesso |
|---|---|---|---|
| Onboarding | Se a pessoa encontra o guia e o percorre até o fim | `?task=onboarding&mazeStep=start` | `mazeStep=onboarding-complete` |
| Compra | Se a pessoa consegue fazer uma entrada de US$10 em UP | `?task=buy&mazeStep=start` | `mazeStep=purchase-complete` |
| Venda | Se a pessoa encontra Entradas e vende a posição inteira | `?task=sell&mazeStep=start` | `mazeStep=sale-complete` |
| Ajuda | Se a pessoa acha a resposta sobre divergência de preço | `?task=help&mazeStep=start` | `mazeStep=answer-shown` |

## 2. O que cada URL precisa fazer

1. Abrir um estado preparado especificamente para a tarefa.
2. Funcionar sem depender das tarefas anteriores.
3. Restaurar o mesmo cenário em cada nova abertura.
4. Usar os mesmos valores para todos os participantes.
5. Atualizar o parâmetro `mazeStep` nos marcos importantes.
6. Manter toda a navegação na mesma aba.
7. Não fazer nenhuma chamada de mercado pela rede.

Uma URL sem `task` válido não deve abrir a Home num estado genérico. Um link
quebrado produziria uma sessão com o cenário de outra tarefa, e essa resposta
entraria na análise sem que ninguém percebesse. O correto é falhar de forma
visível, em espanhol:

```text
Este enlace de prueba no es válido.
Vuelve al estudio de Maze para continuar.
```

## 3. Marcos intermediários

Os marcos abaixo do sucesso não validam a missão; existem para ler o caminho
percorrido. Devem sair dos eventos reais da interface, sem botão artificial
criado só para avançar a pesquisa.

### Onboarding

```text
?task=onboarding&mazeStep=start
?task=onboarding&mazeStep=onboarding-open
?task=onboarding&mazeStep=onboarding-complete
```

Fechar o guia no X ou arrastando **não** pode marcar sucesso: abrir não é o mesmo
que entender, e a tarefa pede a segunda coisa.

### Compra

```text
?task=buy&mazeStep=start
?task=buy&mazeStep=buy-betslip-open
?task=buy&mazeStep=purchase-complete
```

### Venda

```text
?task=sell&mazeStep=start
?task=sell&mazeStep=entries-open#entradas
?task=sell&mazeStep=sell-betslip-open#entradas
?task=sell&mazeStep=sale-complete#entradas
```

A tarefa começa na Home de propósito: encontrar `Entradas` é parte do que se
mede, então o link nunca entrega a seção já aberta.

### Ajuda

```text
?task=help&mazeStep=start
?task=help&mazeStep=assistant-open
?task=help&mazeStep=answer-shown
```

`assistant-open` precisa valer para todos os caminhos de entrada do assistente —
link da Home, grupo `SOPORTE` do menu de perfil e card do `Centro de ayuda` —,
senão a tarefa registra só quem entrou por um deles. `answer-shown` marca quando
a resposta aparece na conversa, e não no envio da pergunta: a pessoa só encontrou
o que procurava quando o texto está na tela.

## 4. Achados de uma implementação exploratória

Uma versão exploratória chegou a ser construída e depois removida deste
repositório. Ela permanece no histórico da branch `research/maze-v1` e no Pull
Request nº 1. O que se aprendeu ali, e que economiza tempo de quem for
implementar:

- **A URL deve ser reescrita com `replaceState`, não `pushState`.** A aplicação
  já navega por hash e por `pushState`; empilhar uma entrada por marco faz o
  botão voltar exigir vários toques no meio da missão. Em contrapartida, é
  preciso confirmar no piloto que o Maze detecta mudança de query parameter na
  mesma página, sem recarregamento. Se não detectar, configurar o bloco para
  aceitar a URL de sucesso como *contains* antes de recorrer a `pushState`.
- **A ordem dos parâmetros precisa ser fixa.** O Maze compara URLs como texto,
  então `?task=buy&mazeStep=start` e `?mazeStep=start&task=buy` seriam links
  diferentes para o mesmo estado.
- **Nada dinâmico pode entrar na URL** — identificador de participante,
  timestamp, valor de carteira. Dois participantes no mesmo ponto da mesma tarefa
  precisam produzir exatamente a mesma URL para o Maze agrupar os caminhos.
- **A pergunta sobre divergência de preço não resolve sozinha.** Frases naturais
  que citam “el precio de bitcoin … otra plataforma” caem no reconhecedor de
  preço ao vivo do assistente e recebem a cotação do momento, em vez do FAQ
  `price-difference`. Sem tratar isso, a tarefa de ajuda falha por vocabulário, e
  não por dificuldade de encontrar o assistente. **Vale como achado para o Pulse
  principal, independentemente do estudo.**
- **O percentual é o preço.** O onboarding diz `El % indica el precio`: 67% e 67¢
  são o mesmo número. Não há como mover UP sem mover o preço por participação, e
  portanto sem mudar as participações, o recebimento e o saldo final.
- **A proteção de execução do betslip tolera 1¢.** Um mercado simulado que se
  mova mais rápido que isso faz a confirmação da compra ser recusada no meio da
  tarefa, e o participante vê um erro que não existe no produto.

### Consequência do gráfico contínuo

O Pulse ganhou depois do primeiro snapshot um histórico de gráfico que atravessa
rodadas e é persistido em `localStorage` sob a chave `pulse.chart-history.v1`
(`src/services/chartHistoryCache.ts`). Duas implicações para quem implementar o
estudo:

- A chave precisa entrar no namespace do estudo, junto das demais. Se ficar como
  está, o gráfico da pesquisa lê e escreve o histórico do Pulse principal aberto
  no mesmo aparelho — e um participante veria pontos de preço real misturados aos
  simulados.
- O histórico atravessar rodadas e sobreviver ao reload é bom para o produto e
  ruim para a repetibilidade do estudo: uma segunda abertura da mesma tarefa
  restauraria a curva da primeira. A limpeza do namespace na entrada por uma URL
  de tarefa precisa alcançar essa chave.

## 5. Snippet do Maze

**Situação: pendente.** O snippet oficial ainda não foi fornecido pela equipe.

É único por conta do Maze. Não invente ID, endpoint ou código de tracking: o Maze
só reconhece o snippet da própria conta. Ele deve ser instalado apenas no
ambiente do estudo e carregar nas quatro URLs.

A entrada livre do assistente precisa carregar `data-maze-mask="True"`, para o
Maze mascarar o conteúdo digitado na gravação: a análise vê que houve uma
pergunta, sem guardar o texto dela.

## 6. Configuração de dispositivo

O protótipo é exclusivamente mobile e cobre o conteúdo com o aviso `MobileOnly` a
partir de `500px` de largura, então o estudo precisa rodar em celular.

- Marcar os quatro blocos como **mobile only** no Maze.
- Larguras a validar: 320×568, 375×812, 390×844, 430×932 e 499×900.

## 7. Privacidade

- Nenhum dado pessoal na URL.
- Sem login, pagamento, depósito ou saque. Saldo e operações simulados.
- Campo livre do assistente mascarado (seção 5).
- O bloco de consentimento está em [MAZE_STUDY_PLAN_PTBR.md](MAZE_STUDY_PLAN_PTBR.md).

## 8. Pendências que dependem de terceiros

1. **Snippet do Maze** — não fornecido.
2. **DNS de `pulse-maze.draftea.com`** — não configurado.
3. **Hospedagem** — GitHub Pages em repositório privado exige plano pago; a conta
   está no plano gratuito. O repositório não deve ser tornado público como
   solução de deploy.
4. **Proteção de branch** — mesma limitação de plano.
5. **Piloto técnico** — depende do snippet e da URL publicada. É o passo que
   valida a detecção de mudança de query parameter descrita na seção 4.

## 9. Congelamento da coleta

A versão usada na coleta deve ficar congelada por tag. Qualquer correção
posterior gera uma versão nova, com registro do que mudou e de quais
participantes receberam cada versão.
