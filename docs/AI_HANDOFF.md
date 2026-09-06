# Handoff entre Codex e Claude

## Estado atual

- Atualizado em: 2026-09-04
- Agente que entrega: Codex
- Status: implementação e validação local concluídas; sem commit, PR, merge ou deploy nesta tarefa
- Objetivo: preservar os pontos reais recentes do gráfico após F5 e experimentar escala LIVE com piso de US$ 0,25, sem usar cache como cotação atual.
- Branch: `fix/chart-history-persistence`, criada da `origin/main` atualizada, checkout inicialmente limpo.

### Escopo e decisões

- Correção do relato posterior de picos após F5: a seleção inicial já aguardava 3s para fixar uma fonte, mas o preço publicado escapava dessa espera. `useBtcPriceFeeds` agora publica somente Chainlink durante a espera; Coinbase/Kraken entram após o prazo se necessário. `selectInitialPriceFeed` foi acrescentado a `marketFallback.ts` com teste de regressão.
- `mergePricePointSeries` agora usa candles apenas antes da primeira observação válida. Lacunas entre observações restauradas não recebem pontos de outra fonte/resolução; teste cobre histórico tardio e série vazia.
- Reprodução controlada no navegador a 375px: cache perto de 100, Coinbase chegando primeiro a 110 e Chainlink após 1,6s a 100,03. A lógica anterior publicou 110 e deixou um pico salvo; a corrigida registrou 79 amostras a 100,03, sem picos. Isso reproduz o mecanismo observado; não recupera a sequência exata de pacotes do print original.
- Contingência controlada sem Chainlink também validada: Coinbase entrou após a espera e permaneceu como fonte. Harnesses e cópias temporárias da lógica antiga removidos.
- Testes atualizados: 49 em `test:chart`, 7 em `test:fallback`, lint/build passando (aviso conhecido de chunk). Arquivos adicionais: `src/hooks/useBtcPriceFeeds.ts`, `src/services/marketFallback.ts`, `tests/marketFallback.test.ts`.
- Pontos já salvos pela versão anterior não são apagados ou suavizados automaticamente; saem da janela LIVE em 30 segundos e do histórico conforme a retenção de uma hora.

- Continuação autorizada: escala LIVE, inclusive arraste, com `minimumGridStep: 0.25`; o valor padrão de 2.5 permanece para 5M/15M/1H. As alterações anteriores de persistência permanecem juntas nesta branch para o teste local. Nenhum commit ou publicação foi feito.
- Complemento validado: 48 testes, lint e build passando. No navegador a 375px, série controlada de menos de US$ 1 usou passo 0.25 e amplitude 1.50; 5M/15M/1H conservaram passo 2.5. Feed real foi observado em live com passo 2.00 e sem overflow. O harness temporário foi removido.
- Arquivos adicionais: `src/components/priceChartModel.ts`, `src/components/MarketPriceChart/MarketPriceChart.tsx`, `tests/priceChartModel.test.ts`.
- Servidor de teste também disponível na porta 5187, escutando na rede local; abertura pelo endereço LAN validada no navegador. Acesso no celular requer a mesma rede Wi-Fi.

- Cache versionado `pulse.chart-history.v1`, com uma hora e até 3.601 pontos observados, deduplicados por segundo. Restauração síncrona no estado inicial do hook; valores e timestamps originais preservados, inclusive entre rodadas.
- Serialização e leitura descartam pontos inválidos, futuros ou expirados. Cache corrompido/incompatível equivale a vazio. Candles continuam perdendo para observações no mesmo segundo.
- Gravação de alterações agendada a cada segundo após a execução anterior, com flush final em `pagehide`, `visibilitychange` para hidden e unmount. Falhas de armazenamento não interrompem o feed. Proteção equivalente adicionada à leitura/gravação do cache de rodadas, que antes poderia interromper a inicialização.
- A cotação atual e o status continuam vindo exclusivamente do feed. Primeira visita e períodos sem observações continuam dependendo do histórico disponível; domínio vertical é recalculado.
- Sem dependências novas, backend ou alteração visual dos controles.

### Arquivos alterados

- `src/services/chartHistoryCache.ts` (novo), `src/hooks/useResilientBtcMarketRound.ts`.
- `tests/chartHistoryCache.test.ts` (novo), `package.json` (suíte test:chart), `docs/AI_CONTEXT.md`, `docs/AI_HANDOFF.md`.

### Validações

- `pnpm test:chart`: 46 testes passando; seis novos cobrem restauração/continuidade, expiração, dados inválidos/futuros, versão, limite/deduplicação, precedência sobre candles e armazenamento bloqueado.
- `pnpm lint` e `pnpm build`: passando; permanece aviso conhecido de chunk acima de 500 kB. `git diff --check`: limpo.
- App real em 375×812: após acumular mais de 30s, F5 conservou os 23 pontos visíveis da janela LIVE imediatamente, ainda em `connecting`. O feed retomou em `live`. Outro F5 na rodada seguinte restaurou 162 pontos observados, 26 visíveis, também antes da conexão.
- Ranges LIVE/5M/15M/1H publicaram respectivamente 30000/300000/900000/3600000 ms, sem overflow horizontal; gesto real de arraste entrou no histórico.
- Harness temporário com o hook e o gráfico reais, relógio/feed controlados: 40/40 pontos preservados na virada, preço inicial null e status connecting durante atraso de 15s; novos pontos chegaram após a reconexão. Recarga subsequente preservou 46/46 pontos. Com armazenamento bloqueado, iniciou vazio e acumulou preços em live sem erros. Cache vazio também iniciou sem pontos e evoluiu normalmente.
- Eventos controlados de pagehide/visibilitychange verificaram flush final. Após ajuste do agendamento, 20 intervalos normais de gravação medidos entre 1000 e 1004 ms. O harness e suas fixtures foram removidos.

### Pendências e próximo passo

- Nenhuma pendência de implementação/validação local deste escopo. Alterações permanecem sem commit para revisão; PR, merge e publicação estão fora da autorização desta etapa.
- Servidor local de desenvolvimento disponível em `http://127.0.0.1:5186/`.

## Histórico: LIVE de 30 segundos


- Atualizado em: 2026-09-04
- Agente que entrega: Codex
- Agente esperado a seguir: pessoa usuária, para novos ajustes de produto
- Status: concluído — commit `7ccfc44`, PR #66, merge `ed623cb` e deploy do GitHub Pages `33927811225` concluídos
- Objetivo: ampliar o range `LIVE` do gráfico para os últimos 30 segundos em qualquer largura mobile, com marcações de 10 segundos e domínio vertical calculado por toda a janela visível
- Branch: `feature/live-chart-30s`, integrada à `main`; branch remota removida no merge

### Escopo e decisões

- `LIVE` mantém `durationMs: null` como identificador semântico, mas calcula `pixelsPerSecond` pela largura disponível e pela constante de `30.000ms`. O `data-window-span` fica exatamente em `30000` de `320px` a `499px`.
- As marcações móveis do eixo passaram de `5s` para `10s`, evitando sobreposição após a compressão horizontal.
- O domínio ao vivo usa todos os pontos recortados pelos últimos `30s`; o domínio arrastado também considera toda a janela. A tendência continua usando a leitura curta existente, e os ranges `5M`, `15M` e `1H` não mudaram.
- Regra revisada pela pessoa usuária: LIVE usa `historyPoints` e atravessa a virada da rodada. Arraste consulta até uma hora, preserva a âncora na virada e respeita a expiração do histórico. Domínio estabilizado não reinicia por `roundStart`; timer e objetivo continuam mudando normalmente. Histórico vazio usa os pontos reais da rodada como contingência.
- Ajuste posterior: linha, área e bolinha compartilham a coordenada final `currentPoint`; pontos projetados na borda ou além dela são substituídos por essa ponta. No arraste, a série original não recebe o preço animado atual. Nenhuma prop pública ou dependência foi adicionada.

### Arquivos alterados

- `src/components/priceChartModel.ts`
- `src/components/PriceChart.tsx`
- `src/components/MarketPriceChart/MarketPriceChart.tsx`
- `tests/priceChartModel.test.ts`
- `docs/AI_CONTEXT.md`
- `docs/AI_HANDOFF.md`

### Validações

- `pnpm test:chart`: 40 testes passando, incluindo ponta compartilhada, virada com 30s contínuos, retenção do arraste e histórico parcial/vazio.
- `pnpm lint`: limpo.
- `pnpm build`: concluído; permanece apenas o aviso conhecido de chunk acima de `500kB`.
- Navegador local em `320×568`, `375×812`, `430×832` e `499×900`: `data-window-span="30000"`, sem overflow horizontal e sem sobreposição entre os horários visíveis de 10 segundos.
- Em `375×812`, `5M`, `15M`, `1H` e `LIVE` publicaram respectivamente `300000`, `900000`, `3600000` e `30000`; o arraste entrou no histórico e o botão `LIVE` voltou ao presente em `320ms`. Console sem erros ou avisos.
- GitHub Actions executou build, testes, lint e deploy em `33927811225`. A versão publicada em `https://design-draftea.github.io/pulse/` respondeu em mobile com `data-window-span="30000"`.

### Pendências e próximo passo

- Continuidade validada em cenário React controlado no navegador: virada preservou 32 pontos renderizados (incluindo guarda), janela de 30000ms e domínio 92.5–107.5 enquanto o objetivo mudou de 100 para 101. Durante arraste, a âncora permaneceu exatamente igual antes/depois; contingência sem histórico anterior renderizou os nove pontos reais disponíveis. O arquivo temporário de QA foi removido após o teste.
- Sincronização: antes do ajuste, a amostra de 40 leituras incluiu 10 movimentos, sem reproduzir a falha intermitente (diferença inferior a `0,005px`). Após o ajuste, 320 leituras nas quatro larguras estabilizadas incluíram 29 movimentos, sem movimento da bolinha com caminho inalterado; diferença inferior a `0,005px`. Mais 80 leituras no arraste, 100 durante retorno e 160 nos quatro ranges também ficaram abaixo de `0,005px`. A medição comparou a coordenada final do caminho SVG com o centro renderizado da bolinha. Console sem erros. Isso verifica a conexão geométrica; não comprova a causa do relato intermitente original.
- Não há pendência de código, Pull Request, merge ou publicação neste escopo.


## Histórico: zoom e teclado do assistente

- Atualizado em: 2026-09-04
- Agente que entrega: Codex
- Agente esperado a seguir: GitHub Actions, para validar e publicar a `main` após o merge autorizado
- Status: implementação e validação local e no iPhone concluídas; Pull Request e merge autorizados pela pessoa usuária
- Objetivo: remover zoom/pinça de todo o Pulse e fazer o compositor do `Pregúntale a Pulse` acompanhar o teclado como o bottom sheet de `/criar-conta` do Draftaco
- Branch: `fix/zoom-teclado-assistente`, criada a partir da `main` limpa

### Escopo e decisões

- A meta viewport agora limita a escala e usa `viewport-fit=cover`. Os eventos `gesturestart`, `gesturechange` e `gestureend` cobrem a exceção do Safari iOS, e o reset global usa `touch-action: pan-x pan-y` para manter scroll/drag sem zoom por pinça ou duplo toque.
- O `ProfileBottomSheet` continua sendo o componente existente. A implementação final segue o modo estável do cadastro: congela a altura externa em `--profile-sheet-stable-height` e calcula `--profile-sheet-keyboard-inset` pela diferença até o fim visível da `visualViewport`. Header, sheet e introdução permanecem parados; o inset interno sobe somente o compositor.
- O input do assistente passou de `14px` para `16px`, removendo o zoom automático que o Safari aplica ao focar campos menores que `16px`.
- Depois do primeiro teste no iPhone, a pessoa usuária confirmou que o zoom sumiu, mas o foco ainda movia o conteúdo do sheet. O input passou a usar o mesmo `useTapFocusScrollGuard` do cadastro do Draftaco: o foco nativo é bloqueado no `pointerdown`, o campo recebe `focus({ preventScroll: true })` no `pointerup` e a posição da página e dos scrollers ancestrais é restaurada imediatamente, em dois frames e após `80ms`, `160ms` e `320ms`.
- No segundo teste, o problema apareceu apenas depois de recolher o teclado pelo botão nativo do iOS e tocar novamente no input; tocar fora antes fazia funcionar. O diagnóstico confirmou que o botão recolhe o teclado, mas deixa o input como `document.activeElement`, e a exceção para campos já focados deixava o segundo toque escapar do guard. Agora essa exceção vale somente com teclado realmente aberto (ou mouse): com o teclado fechado, o `pointerup` desfoca e refoca sincronamente, dentro do gesto da pessoa usuária, reaplicando `preventScroll` e a restauração de scroll.
- O conjunto foi completado com `useStableKeyboardViewport` e `useTouchScrollFence`, também portados do Draftaco. Como o Pulse pode abrir o sheet com a Home rolada, a trava da janela preserva a posição capturada na abertura em vez de forçar `scrollY = 0`.

### Arquivos alterados

- `index.html`
- `src/index.css`
- `src/components/ProfileBottomSheet/ProfileBottomSheet.tsx`
- `src/components/ProfileBottomSheet/ProfileBottomSheet.css`
- `src/components/HelpAssistant/HelpAssistant.css`
- `src/hooks/useTapFocusScrollGuard.ts` (novo)
- `src/hooks/useStableKeyboardViewport.ts` (novo)
- `src/hooks/useTouchScrollFence.ts` (novo)
- `docs/AI_CONTEXT.md`
- `docs/AI_HANDOFF.md`

### Validações

- `git diff --check`, `pnpm lint`, `pnpm build` e `pnpm test:help` concluídos; 63 testes do assistente passando. O aviso existente de chunk acima de 500 kB permanece.
- Navegador local a `390×844`: assistente aberto sem overflow horizontal e compositor inteiro.
- Teclado simulado reduzindo a viewport para `390×500`: a altura externa permaneceu em `844px`, o sheet permaneceu de `56px` a `844px` e o inset interno virou `344px`. O compositor terminou em `500px`, exatamente na borda visível, sem mover o topo do sheet ou da introdução.
- Foco protegido conferido no navegador: antes do clique, depois do foco, com o teclado aberto e após fechá-lo, `window.scrollY` permaneceu em `307`, o scroller da conversa e o conteúdo da rota permaneceram em `0`, o topo do sheet em `56px` e o topo da introdução em `132px`. O inset percorreu `0 → 344 → 0px` e o compositor `844 → 500 → 844px`.
- Meta viewport conferida no documento carregado e console sem erros ou avisos.
- Regressão do refoco coberta no código pelo estado combinado `input focado + visualViewport sem teclado`; lint, build, `git diff --check` e os 63 testes do assistente continuaram passando depois do ajuste. O controle nativo de recolher teclado só existe no iOS real, por isso a confirmação final dessa sequência permanece com a pessoa usuária.
- A pessoa usuária repetiu no iPhone a sequência exata `focar → recolher pelo botão nativo → tocar novamente no input` e confirmou que o ajuste funcionou. Depois disso, decidiu manter sem alterações a interface nativa do teclado e autorizou commit, Pull Request e merge.

### Pendências e próximo passo

- Abrir o Pull Request, acompanhar os checks, fazer o merge autorizado e verificar o deploy automático do GitHub Pages.


## Histórico: assistente com dados ao vivo (PR #63)

- Atualizado em: 2026-09-04
- Agente que entrega: Claude
- Agente esperado a seguir: pessoa usuária, para revisar a copy dos tópicos exclusivos do assistente
- Status: concluído — PR #63, merge `7e05f28`, deploy `33899809725` com sucesso e publicação verificada no artefato real. A pessoa usuária autorizou explicitamente commit, PR e merge
- Objetivo: o assistente respondia `No encontré una respuesta segura` para perguntas centrais do produto, entre elas `¿Cuál es la probabilidad de que yo gane?`. Passa a responder com os dados reais do momento, sem modelo, chave, backend ou custo de IA
- Branch: `feature/assistente-probabilidade`, criada a partir da `main` em `94599be`, integrada pelo PR #63 e removida do remoto
- Worktree: `.worktrees/feature-assistente-probabilidade`, removido após o merge, junto da branch local

### O diagnóstico

- `askHelpAssistant` era só um recuperador de texto sobre 27 documentos fixos e recebia apenas `availableBalanceCents` e `hasOpenEntries`. Não conhecia a rodada, o preço, a posição nem o histórico, embora tudo isso já fosse calculado em `src/App.tsx`.
- Medido no motor real antes da mudança: `¿Cuál es la probabilidad de que yo gane?`, `¿Cuánto cuesta UP ahora?`, `hola`, `gracias` e `no entendí nada` caíam em confiança baixa; `¿Cuánto tiempo queda?` e `¿Cuánto gano si pongo $10 en UP?` só pediam esclarecimento.
- O conceito que faltava é o do próprio produto: num prediction market o preço da participação **é** a probabilidade implícita. A Home já exibia `62%` no `MarketChoice`; o assistente é que não tinha acesso ao número.

### Escopo e decisões

- O retrato ao vivo é montado em `App.tsx` a partir de estado existente, guardado num ref e entregue como getter estável. `quoteBuy` e `quoteSell` do `outcomeMarket` vão junto, então o simulador e o valor de venda usam a mesma cotação que o betslip usaria, caminhando o livro real, em vez de reimplementar `monto ÷ preço`.
- A resposta passou a ser calculada no instante em que ela aparece, e não no envio. Com dado ao vivo, os `2s` do indicador de digitação deixavam o número dois segundos velho: medido no navegador, o chat dizia `UP 48%` enquanto a Home mostrava `UP 55%`. Depois da mudança, os dois leram `UP 56% · DOWN 44%` no mesmo instante.
- O porcentual usa `Math.round(price * 100)`, exatamente como o `MarketChoice`. Os dois lados são apresentados de forma independente e a copy nunca afirma que somam 100%, porque o livro real produz pares como `88%` e `13%`.
- Nenhuma resposta estima dado ausente. Preço nulo, mercado indisponível, histórico vazio, profundidade insuficiente para o monto ou monto acima do teto do campo de compra têm cada um a sua resposta explícita.
- A recusa de recomendação e de previsão deixou de ser um beco sem saída: continua recusando e entrega o preço de mercado do momento como o dado honesto que existe no lugar da opinião. Um teste fixa a fronteira: `¿me conviene UP?` é recusa, `¿qué probabilidad tengo de ganar?` é resposta.
- O histórico das últimas rondas responde a contagem real e sempre fecha com a ressalva de que cada rodada é independente. Decisão da pessoa usuária, tomada durante o planejamento.
- O conteúdo curado é resolvido **antes** dos dados ao vivo. Sem isso, `¿Qué información tiene mi entrada?`, que é uma definição do glossário, seria sequestrada pela consulta à posição real. Um teste percorre todos os enunciados e exemplos curados com um retrato ao vivo presente e exige a mesma fonte de antes.
- A copy nova ficou em `helpTopicItems`, fora das duas telas aprovadas. As 12 perguntas frequentes e os 12 termos do glossário não foram tocados. Promover um tópico para essas telas, depois da sua revisão, é mover o objeto de lista.
- A conversa básica exige o enunciado inteiro, não uma palavra solta: `ayuda` sozinho é uma saudação, mas `ayuda` dentro de uma pergunta real não sequestra a pergunta.
- Interface: destaque de números acima do texto com os tokens `--color-fill-success` e `--color-fill-error`, selo `Dato en vivo · HH:MM` e linhas de apoio. Não há referência de Figma para esta tela, como já registrado na entrega anterior.
- Toda resposta com dados ao vivo oferece de um a dois acompanhamentos, reaproveitando o mecanismo de sugestões que já existia. Eles ficam num mapa único (`FOLLOW_UPS`) e um teste percorre esse mapa exigindo que cada `query` resolva em conteúdo de alta confiança: um chip que cai no fallback seria pior do que nenhum chip. Dois pares são editoriais, não decorativos: depois de mostrar um ganho estimado, o assistente oferece `¿Puedo perder el monto?`; depois da contagem do histórico, oferece `¿Qué probabilidad hay ahora?`, que desvia a leitura de padrão para o número do momento.
- Promoção de conteúdo decidida pela pessoa usuária depois da entrega inicial: `Probabilidad implícita` subiu para o glossário visível e `¿Puedo perder el monto que utilicé?` para as perguntas frequentes. O critério aplicado foi se a pessoa procuraria aquilo navegando ou só pensaria em perguntar. Os outros sete tópicos continuam exclusivos do assistente. `¿Es un juego de azar?` ficou de fora por decisão consciente: numa tela visível ela deixa de ser resposta e vira posicionamento do produto, o que é decisão de produto e de compliance. `Depósitos y retiros` também ficou de fora, porque os botões inertes são um estado conhecido do protótipo e serão tratados depois.

### Segunda rodada de ajustes, pedida depois da entrega inicial

Uma sondagem com 15 perguntas de testador real mostrou 6 falhas, 4 ambiguidades e, pior, **2 respostas confiantes e erradas**. As duas vinham do que esta tarefa tinha acrescentado.

- `¿Puedo cambiar de UP a DOWN?` caía no tópico `Por qué cambia el precio de UP y DOWN`, porque `UP` e `DOWN` estavam no título e `cambiar` fica a uma edição de `cambia`. O título passou a ser `Por qué cambia el precio de las participaciones` e entrou o tópico `Cambiar de lado o tener los dos`, que responde de verdade.
- `¿Cuántas rondas hay al día?` caía na contagem do histórico, porque o reconhecedor aceitava `cuántas` + `rondas`. Agora exige uma palavra de desfecho. Entrou o tópico `Cuántas rondas hay`, com as 96 rondas de 15 minutos.
- Venda ao vivo: `¿Cuánto me dan si vendo ahora?` caía no fallback, embora `quoteSell` já estivesse no instantâneo. Agora responde o monto, o preço por participação, o resultado contra o custo e o que aconteceria esperando o fechamento. `¿Me conviene vender?` é recusa, mas entrega os dois montos.
- Rodada liquidada: `settledEntries` entrou no instantâneo. `¿Gané la ronda anterior?` conta o desfecho real nos quatro estados possíveis, e perguntas de total respondem o acumulado, dizendo explicitamente que a carteira do protótipo não separa por dia.
- Conteúdo novo: rangos do gráfico, cambiar de lado, quantas rondas há. `¿Cuándo me pagan?` passou a alcançar o termo `Liquidación`, que já tinha a resposta.
- Digitação: `correctTypos` corrige a consulta com o vocabulário do próprio catálogo, antes de qualquer resolução. Só palavras longas desconhecidas e só com candidato único. A tolerância do ranqueamento também aceita duas edições em palavras de oito letras ou mais, pontuando menos.
- Uma armadilha encontrada durante a implementação: `gané` e `gane` ficam idênticos depois de tirar o acento, então o reconhecedor de pretérito lia `la probabilidad de que yo gane` como uma pergunta sobre o passado. As formas sem ambiguidade resolvem, e um teste trava o caso.

### Arquivos alterados

- `src/services/helpAssistantSnapshot.ts` (novo)
- `src/services/helpAssistantTypes.ts` (novo)
- `src/services/helpAssistantLive.ts` (novo)
- `src/services/helpAssistant.ts`
- `src/content/help/es-MX/helpContent.ts`
- `src/components/HelpAssistant/HelpAssistant.tsx`
- `src/components/HelpAssistant/HelpAssistant.css`
- `src/components/ProfileBottomSheet/ProfileBottomSheet.tsx`
- `src/App.tsx`
- `tests/helpAssistantLive.test.ts` (novo)
- `tests/helpAssistant.test.ts`
- `package.json`
- `docs/AI_CONTEXT.md`
- `docs/AI_HANDOFF.md`

### Validações

- `pnpm lint` limpo, `pnpm build` concluído. O aviso existente de chunk acima de 500 kB permanece; nenhuma dependência foi adicionada.
- 144 testes passando, contra 117 antes. As 17 asserções anteriores do assistente continuam no arquivo **sem edição** e passam.
- Navegador local em `127.0.0.1:5187`, a `416×878`. Com uma compra real de `$100` em UP, `¿Cuál es la probabilidad de que yo gane?` devolveu `El 88% que ves en UP es la probabilidad implícita... Tienes 120.48 participaciones en UP`, com `Compraste a $0.83 en promedio` e `Si UP gana, recibes $120.48`.
- Chat contra Home, lidos no mesmo instante: `UP 56% · DOWN 44%` nos dois.
- Simulador contra betslip, com `$100` em DOWN: os dois reportaram preço promedio `16¢`. A diferença de participações (`624.65` contra `610.72`) é só o preço se movendo entre as duas leituras; a função de cotação é literalmente a mesma.
- Contagem do histórico conferida contra os cards reais de `Últimas 10 rondas`: `6` arriba e `4` abajo nos dois.
- Saldo: `$1,940.00` disponível e `$2,045.69` de total, conferidos contra o cabeçalho e o perfil depois da compra.
- Ações conferidas: `Ver últimas rondas` fechou o sheet e centralizou a seção real; `Ver mis entradas` abriu `#entradas`.
- Segunda rodada conferida no navegador a `416×878`, com compra real: `¿Cuánto me dan si vendo ahora?` devolveu `323.38 participaciones de UP, recibes $85.90`; `¿Me conviene vender?` recusou e deu os dois montos; `¿Puedo cambiar de UP a DOWN?` e `¿Cuántas rondas hay al día?` passaram a responder o tópico certo; `¿Cuanto tienpo qeda?`, com dois erros de digitação, chegou à resposta da rodada. Com uma rodada liquidada de verdade, `¿Gané la ronda anterior?` leu o desfecho, o monto e as participações da carteira, e `¿Cuánto llevo ganado?` devolveu o acumulado.
- Zero requisições `fetch` em três perguntas seguidas, medido de novo depois dos ajustes. Sem overflow a `320×568` e `430×832`.
- Acompanhamentos conferidos no navegador: a probabilidade ofereceu `¿Cómo se calcula ese porcentaje?` e `¿Puedo perder el monto?`; o histórico ofereceu `¿Qué probabilidad hay ahora?` junto da ação; o simulador ofereceu `¿Puedo perder el monto?` e `¿Puedo vender antes?`. O chip do porcentual abriu a definição do glossário, e a fonte da resposta virou botão, porque o termo agora existe na tela aprovada.
- Telas aprovadas conferidas depois da promoção: o glossário passou a `13` termos, com `Probabilidad implícita` na posição `9`, logo após `Participación`; as perguntas frequentes passaram a `13`, com `¿Puedo perder el monto que utilicé?` na posição `9`, logo após `¿Cuánto puedo recibir si acierto?`. Sem overflow horizontal em nenhuma das duas.
- O retorno da fonte continua correto depois da promoção: o glossário aberto pelo chat voltou para a conversa preservada.
- Rede: com `window.fetch` instrumentado, três perguntas seguidas dispararam **zero** requisições. Os erros `400` no console são das chamadas de dados de mercado do próprio app e são anteriores a esta mudança.
- Layout sem overflow horizontal a `320×568`, `375×812` e `430×832`; a `375×400`, simulando o teclado, o compositor permaneceu inteiro e colado ao fundo.
- O estado do protótipo foi restaurado ao saldo inicial de `$2,040.00` ao fim da validação.

### Pendências e próximo passo

- Revisar a copy dos sete tópicos que continuam em `helpTopicItems` e da conversa básica em `helpSmallTalkItems`. Nada disso aparece nas telas de perguntas frequentes ou do glossário.
- Revisar as duas entradas promovidas, que agora são visíveis: o termo `Probabilidad implícita` no glossário e a pergunta `¿Puedo perder el monto que utilicé?` nas perguntas frequentes.
- `Depósitos y retiros` segue só no assistente. Os botões `Depositar` e `Retirar` continuam visíveis e inertes no perfil; a pessoa usuária registrou que isso será tratado depois, por ser um protótipo.
- Não validado: o caminho de preço indisponível de forma forçada. Ele foi observado funcionando no app real durante uma troca de rodada, às `13:29`, e está coberto por testes para preço nulo e para mercado indisponível. Não foi possível forçá-lo pelos parâmetros de injeção de falha porque a contingência local repõe os preços, que é justamente o comportamento desejado do protótipo.
- Não validado: o teclado real no Chrome do iPhone, pendência que já vinha da entrega anterior.
- Revisar a copy dos três tópicos novos: `Cambiar de lado o tener los dos`, `Rangos del gráfico` e `Cuántas rondas hay`. Nenhum aparece nas telas aprovadas.
- Existe uma entrada local `pulse-assistente-5187` em `.claude/launch.json`, que não é versionada, apontando para este worktree. Removê-la depois que a branch sair.
- Publicação verificada em `https://design-draftea.github.io/pulse/` a `416×878`: o bundle `assets/index-6uUDbJ_s.js` traz `Glosario en Pulse`, `probabilidad implícita del mercado`, `Si vendes ahora tus`, `96 rondas por día`, `Cambiar de lado o tener los dos`, `Dato en vivo`, `no puedo recomendarte vender` e `Cada ronda es independiente`. No artefato real, `¿Cuál es la probabilidad de que yo gane?` devolveu `UP 50% · DOWN 50%` com o mesmo valor que o `MarketChoice` exibia, `¿Puedo cambiar de UP a DOWN?` e `¿Cuántas rondas hay al día?` responderam o tópico certo e `¿Cuanto tienpo qeda?`, com dois erros de digitação, chegou à resposta da rodada.
- As entradas locais `pulse-assistente-5187` e `pulse-assistente-lan` de `.claude/launch.json` apontavam para o worktree removido e foram apagadas. Esse arquivo não é versionado.
- Não há pendência de código, merge ou publicação para este escopo.


## Histórico: assistente conversacional local (PR #60)

- Atualizado em: 2026-09-04
- Agente que entrega: Codex
- Agente esperado a seguir: pessoa usuária para novos ajustes de produto
- Status: concluído — commit `466850e`, PR #60, merge `51d397e`, GitHub Pages publicado e verificado
- Objetivo: substituir `Aprende a jugar` no Centro de ayuda por um assistente conversacional local para usuários do Pulse, sem modelo, chave, backend ou custo de IA
- Branch: `feature/assistente-ajuda-local`, integrada à `main` pelo PR #60
- Worktree: `/private/tmp/pulse-assistente-ajuda-local`; o checkout principal permaneceu na `fix/chart-time-labels`, com as alterações locais da outra task intocadas

### Escopo e decisões

- O card central passou a ser `Pregúntale a Pulse`, usando o `iconMessage.svg` fornecido pela pessoa usuária e preservando a geometria e o brilho do card anterior. O mesmo balão identifica o assistente no menu, enquanto `Preguntas frecuentes` conserva `iconFaq.svg`. `Hablar con alguien` continua sem ação; não existe encaminhamento fictício para suporte.
- A lista de links da Home ganhou `Pregúntale a Pulse` entre `Preguntas frecuentes` e `Hablar con alguien`; o novo link abre o assistente diretamente como raiz do sheet. O antigo rótulo `Soporte` passou a ser `Hablar con alguien`, sem adicionar um destino externo inexistente.
- O grupo `SOPORTE` do perfil agora contém `Hablar con alguien`, `Preguntas frecuentes` e `Pregúntale a Pulse`. O chat aberto por esse menu retorna ao perfil; aberto pelo card do Centro de ayuda, continua retornando ao Centro de ayuda.
- `Asistente Pulse` é uma nova rota de profundidade 2 no `ProfileBottomSheet`, com introdução, três sugestões, histórico da sessão, campo de texto e compositor fixo. O histórico não persiste depois que o sheet desmonta.
- Os 12 FAQs e 12 termos do glossário saíram do componente visual e viraram conteúdo estruturado. As respostas aprovadas não foram reescritas; foram acrescentados exemplos e palavras-chave para recuperação. O catálogo também descreve `Últimas 10 rondas`, `Gráfico de precio` e `Movimientos`, com aliases e ações quando existe um destino seguro.
- O motor v2 normaliza caixa, acentos, pontuação e `diez`/`10`; reconhece a intenção, resolve enunciados e conceitos exatos antes do ranking, pondera títulos, aliases, exemplos, palavras-chave e respostas, tolera uma edição em termos com pelo menos cinco caracteres e só assume uma resposta ranqueada quando existe distância suficiente para o segundo candidato. Conceitos únicos não são penalizados por serem curtos; palavras genéricas continuam ambíguas.
- O último tópico de conteúdo com confiança alta fica apenas na memória da conversa. Isso permite continuações curtas como `¿Y cuándo gana?` depois de `¿Qué es UP?`, sem usar o histórico para forçar uma pergunta externa ou ambígua.
- Saldo e existência de entradas abertas vêm de `ProfileBottomSheetMetrics`. As ações são estruturadas e fecham o sheet antes de usar a navegação existente: `Ver mis entradas` abre `#entradas`, `Ver movimientos` abre `#movimientos` e `Ver últimas rondas` volta à Home e centraliza a seção real.
- Consultas pedindo recomendação de UP/DOWN ou previsão de Bitcoin recebem resposta fixa. Como não existe modelo, a pergunta nunca executa instruções nem produz texto novo.
- Ao abrir uma fonte a partir do chat, o retorno volta para a conversa preservada. FAQ e glossário abertos diretamente pelo Centro de ayuda continuam voltando para o Centro de ayuda.
- A profundidade das fontes agora é contextual: uma FAQ ou o glossário abertos pelo assistente ocupam o nível 3, fazendo o assistente sair para a esquerda e a fonte entrar pela direita; no retorno, a fonte sai à direita e o assistente volta pela esquerda. O atalho direto do Centro de ayuda para o glossário redefine explicitamente o retorno para o Centro de ayuda, sem reaproveitar uma visita anterior feita pelo chat.
- A pergunta enviada entra da direita para a esquerda por `24px` com fade em `280ms`. A resposta é calculada localmente no envio, mas fica substituída por um indicador de três pontos durante `2s`; depois o mesmo item recebe a resposta e faz fade in de `240ms`. Enquanto existe uma resposta pendente, o campo aceita digitação da próxima pergunta, mas o envio fica desabilitado. `prefers-reduced-motion` remove deslocamento, fade e oscilação dos pontos sem eliminar o estado de espera pedido.
- A subida visual na ida e volta entre Centro de ayuda e assistente vinha de `.profile-sheet__stage--help-assistant .profile-sheet__content`: ao trocar o modo do palco, ela removia o padding também da rota que ainda estava saindo. O estilo de `padding: 0` agora pertence somente a `.profile-sheet__route--help-assistant > .profile-sheet__content`; Centro de ayuda conserva `16px` durante toda a transição e o chat conserva `0px` também durante o retorno.
- Os itens clicáveis do grupo `SOPORTE` herdavam o padding horizontal padrão de `button`, por isso começavam à direita dos itens não clicáveis. `.profile-sheet__menu-button` agora usa `padding: 0`, sem compensações específicas por seção.

### Arquivos alterados

- `src/content/help/es-MX/helpContent.ts`
- `src/services/helpAssistant.ts`
- `src/components/HelpAssistant/HelpAssistant.tsx`
- `src/components/HelpAssistant/HelpAssistant.css`
- `src/components/HelpAssistant/index.ts`
- `src/components/ProfileBottomSheet/ProfileBottomSheet.tsx`
- `src/components/ProfileBottomSheet/ProfileBottomSheet.css`
- `src/components/PulseFooter/PulseFooter.tsx`
- `src/assets/iconMessage.svg`
- `src/App.tsx`
- `tests/helpAssistant.test.ts`
- `package.json`
- `docs/AI_CONTEXT.md`
- `docs/AI_HANDOFF.md`

### Validações

- `pnpm lint` limpo e `pnpm build` concluído. O aviso existente de chunk acima de 500 kB permanece; não foi adicionada dependência.
- As oito suítes do repositório passaram após o rebase sobre os ranges: 117 testes no total, incluindo 17 do assistente. Os testes do assistente cobrem as 12 perguntas oficiais, todos os exemplos curados de FAQ, glossário e produto, todos os aliases de produto, definições de todos os termos do glossário, erros de digitação, ambiguidade, contexto curto, assunto externo, proteções, saldo e entradas.
- Navegador local em `127.0.0.1:5186`, no caminho rodapé → Centro de ayuda → `Pregúntale a Pulse`. Além dos fluxos anteriores, `que es up?` respondeu diretamente com a definição de `UP`, `y cuando gana?` preservou o tópico, `ultimas 10 rondas` trouxe explicação e ação que fechou o sheet e centralizou a seção real, e `donde veo mis movimientos` abriu `#movimientos`.
- Novos acessos conferidos no navegador a `416×878`: a Home exibiu os cinco links na ordem esperada e abriu `Asistente Pulse` sem seta, por ser a raiz; uma fonte exibiu a seta e retornou à conversa. No perfil, o grupo `SOPORTE` exibiu exatamente as três opções novas, abriu o chat com seta e voltou para `Mi perfil`.
- Ícone e alinhamento conferidos visualmente e por geometria a `416×878`: `Mis datos`, as três opções de `SOPORTE`, `Términos y condiciones`, `Aviso de privacidad` e `Cerrar sesión` ficaram todos com item e ícone em `x=16` e corpo/divisória em `x=60`. `iconMessage.svg` apareceu no menu e no card `Pregúntale a Pulse` do Centro de ayuda.
- Transição medida a `375×812`: na ida, o conteúdo do Centro de ayuda manteve `padding-top: 16px` antes, no primeiro quadro e aos `150ms`; o conteúdo do assistente permaneceu em `0px`. Na volta, o assistente ficou em `0px` nos mesmos três pontos e o Centro de ayuda em `16px`, sem a alteração vertical instantânea anterior.
- Direção das fontes conferida no navegador a `416×878`: assistente e glossário partiram respectivamente de `x=0` e `x=416`; depois de abrir `Fuente: Glosario · DOWN`, ficaram em `x=-416` e `x=0`. Ao voltar, retornaram para `x=0` e `x=416`. Depois desse fluxo, o atalho direto do Centro de ayuda abriu o glossário com ajuda em `x=-416`, assistente em `x=416` e glossário em `x=0`, e a seta retornou corretamente à ajuda.
- Mensagens medidas no navegador: no primeiro quadro a pergunta tinha a animação `help-assistant-question-enter`, opacidade `0` e transformação horizontal de `24px`; aos `1.000ms` o loading continuava presente e a resposta ainda não existia; após `2.097ms` o loading tinha saído e a resposta estava sob `help-assistant-response-fade-in`. O indicador e a resposta foram conferidos também em imagem.
- Layout conferido em `320×568`, `375×812`, `430×832` e `499×900`, sem overflow horizontal. Em `375×400`, simulando a altura reduzida pelo teclado, o compositor permaneceu inteiro e colado ao fundo.
- Console sem erros ou avisos. A consulta do assistente não registrou chamadas `fetch`/XHR nem requisições com nomes de assistente, ajuda, modelo ou embedding.
- O PR #60 foi mesclado em `51d397e6a9cea2cb1cc65b3f4b1edd6d9f5f91bc`. O workflow GitHub Pages `33887177243` concluiu build e deploy com sucesso. Em `https://design-draftea.github.io/pulse/`, a versão publicada foi conferida a `416×878`: ranges `LIVE`, `5M`, `15M` e `1H`, os cinco links da Home, as respostas para `que es up?` e `ultimas 10 rondas`, o retorno das fontes, `iconMessage.svg` e o alinhamento `x=16/60` do menu estavam presentes e funcionais.

### Pendências e próximo passo

- Não há pendência de código, merge ou publicação para este escopo. Não houve referência de Figma para a nova tela; a interface reutiliza tokens e padrões existentes do Pulse e foi aprovada durante a revisão local.
- Verificar o teclado real no Chrome do iPhone. A redução do viewport foi simulada no navegador local, mas não substitui o comportamento do teclado do aparelho.
- A branch foi rebaseada sem conflitos sobre a `main` que já contém os ranges e a correção dos horários do gráfico; lint, build e as oito suítes foram repetidos depois da combinação.


## Histórico: formatação do monto em centavos (PR #56)

- Atualizado em: 2026-09-04
- Agente que entrega: Claude
- Agente esperado a seguir: Claude ou Codex
- Status: concluído — mesclado pelo PR #56, publicado no GitHub Pages e verificado no artefato real. A pessoa usuária autorizou explicitamente PR, merge e deploy durante a entrega
- Objetivo: corrigir a formatação do monto digitado no betslip, que lia cada dígito como dólar inteiro
- Branch: `fix/formato-monto-centavos`, criada a partir da `main` em `a533cce`, commit `6dd9d36`, PR #56, mesclada em `5f46760` e removida do remoto

### O defeito

- O estado `amount` do betslip guardava a sequência de dígitos como valor em dólares. Digitando cinco cincos, o campo `Monto` mostrava `$55,555` em vez de `$555.55`.
- O formatador do campo era o `dollarAmountFormatter`, sem casas decimais, então nem existia como exibir centavos ali.

### A correção

- `amount` passa a guardar a quantidade de **centavos** digitada. `numericAmountCents` é o próprio número e `numericAmount` é ele dividido por 100, invertendo a conversão que existia antes.
- `handleDigit` acumula o dígito e descarta zeros à esquerda, com limite de 7 dígitos (`AMOUNT_MAX_DIGITS`). O teto em dólares continua o mesmo de antes, `$99,999.99`, porque o limite anterior era de 5 dígitos em dólares.
- Os pontos que escreviam o estado a partir de um valor em dólares passam por `toAmountDigits`: `Un toque` e a reposição do monto depois da compra.
- `formatTypedAmount` exibe o valor digitado sempre com duas casas, no campo, no resumo recolhido e no rótulo do swipe. O `dollarGainFormatter` foi renomeado para `dollarCentsFormatter`, porque agora serve às duas leituras.
- Os montos de `Un toque` continuam inteiros (`$10`, `$25`, `$50`), com o `formatAmount` sem decimais.

### Arquivos alterados

- `src/components/BuyBetslip/BuyBetslip.tsx`

### Validações

- `pnpm lint` limpo e `pnpm build` sem erros.
- Navegador em `localhost:5173`, viewport `375px`. Digitando `5` cinco vezes, o campo percorreu `$0.05 → $0.55 → $5.55 → $55.55 → $555.55`. No sétimo dígito parou em `$55,555.55` e a cotação passou para `Saldo insuficiente`, com `Precio promedio` e `Ganancia potencial` em `—`.
- `Hecho` manteve `$12.34`, o swipe leu `Desliza para comprar por: $12.34` e a compra debitou exatamente `-1234` centavos, levando o saldo de `$2,040.00` para `$2,027.66`. O card de entrada aberta exibiu `Monto: $12.34` e o resumo recolhido, `$12.34 Monto`.
- `Un toque` de `$10` debitou `-1000` centavos e o resumo recolhido exibiu `$10.00 Monto`. Os três montos continuaram inteiros na lista.
- Geometria medida a `375px` e `320px`: nenhum overflow horizontal do documento. A `375px`, o valor mais largo possível (`$55,555.55`) mede 90,71px dentro de uma coluna de 98,32px. A `320px`, `$2,000.00` transborda a própria coluna por 5px, dentro do intervalo de 12px entre as métricas, sem sobrepor a métrica vizinha — conferido também em imagem.
- Publicação verificada em `https://design-draftea.github.io/pulse/` a `375px`: o mesmo percurso de dígitos devolveu `$0.05 → $0.55 → $5.55 → $55.55 → $555.55` e o swipe leu `Desliza para comprar por: $555.55`. Deploy `33876511171` concluído com sucesso.
- O estado do protótipo foi restaurado ao saldo inicial ao fim da validação local.
- Não validado: o gesto real de arrasto do swipe. A confirmação da compra foi disparada pelo caminho de teclado do próprio controle (`Enter`), porque o painel do navegador desta sessão não renderiza durante o arrasto.

### Pendências e próximo passo

- Não há próximo passo pendente. A correção está mesclada e publicada.
- `QuickAmountEditorSheet`, que edita os presets de `Un toque`, continua lendo dígitos como dólares inteiros, com limite de 5. Ficou fora do pedido, e os presets são exibidos sem centavos. Se algum dia precisarem de centavos, é o mesmo ajuste feito aqui.
- A `320px`, o campo do monto transborda a própria coluna por até 5px com valores de seis ou sete dígitos. Não sobrepõe nada hoje, mas é o limite da linha de três métricas iguais; vale olhar com quem desenhou se esse viewport importar.


## Histórico: altura do chip ativo (PRs #54 e #55)

- Atualizado em: 2026-09-03
- Agente que entrega: Claude
- Agente esperado a seguir: Claude ou Codex
- Status: concluído — mesclado pelo PR #54 e publicado no GitHub Pages, com a publicação verificada no artefato real. A pessoa usuária autorizou explicitamente PR, merge e deploy depois da entrega técnica
- Objetivo: corrigir o chip ativo, que ficava mais alto e mais largo que os inativos, no betslip e em `Entradas`
- Branch: `fix/altura-chip-ativo`, criada a partir da `main` em `f7166ea`, commit `37020bc`, PR #54, mesclada em `883dd49` e removida do remoto

### O defeito

- O fundo do chip ativo não é um estado do botão: é o pseudo-elemento `::before` do contêiner, com largura e altura fixas e uma borda de 1px em degradê (`padding-box` + `border-box`). Ele desliza por `transform` entre as posições.
- O reset de `src/index.css` é `* { box-sizing: border-box; }`. O seletor universal **não** alcança `::before` e `::after`, então esses dois pseudo-elementos ficavam em `content-box` e somavam os 2px das bordas ao tamanho declarado.
- Medido no navegador antes da correção, em `Entradas`: os botões em 104x32, 86x32 e 82x32, e o pseudo-elemento em 106x34. Com `top: 8px` alinhado à borda superior do botão, os 2px sobravam embaixo e à direita — daí a leitura de que o chip ativo é mais alto.
- No betslip o mesmo: pílula declarada em 72x32 e renderizada em 74x34.

### A correção

- `box-sizing: border-box` declarado nos dois pseudo-elementos: `.buy-betslip__mode-pills::before` e `.open-entries__tabs::before`.
- A correção é pontual, e não no reset global, porque o repositório já segue essa convenção: `.previous-rounds__card::after`, `.price-comparison__card::after`, `.home-open-entry-card::after`, `.buy-betslip__quick-amount::after` e `.quick-amount-sheet__amount::after` já declaram `box-sizing: border-box` no próprio pseudo-elemento. Mudar o reset para `*, *::before, *::after` também encolheria `.onboarding-series__marker::before`, que hoje é 13px declarado e 15px renderizado, alterando uma ilustração do onboarding já validada e fora do pedido.

### Arquivos alterados

- `src/components/BuyBetslip/BuyBetslip.css` — uma linha
- `src/components/OpenEntries/OpenEntries.css` — uma linha

### Validações

- `pnpm lint` limpo e `pnpm build` sem erros.
- Navegador em `localhost:5173`, viewport mobile. Em `Entradas`, depois da correção, o pseudo-elemento mede 104x32, exatamente o botão `ABIERTAS`, e as três posições continuam corretas: `GANADAS` em `translateX(112px)` com 86 de largura e `PASADAS` em `translateX(206px)` com 82. Conferido também em imagem com `PASADAS` ativo.
- No betslip, pílulas em 72x32 e pseudo-elemento em 72x32, com `Comprar` em `left: 0` e `Vender` em `left: 80`, que é o `translateX(80px)` do estado de venda. Conferido em imagem com `Comprar` ativo.
- Não validado: o estado `Vender` do betslip em imagem. A medição já cobre a geometria, que é a mesma pílula deslocada.

### Pendências e próximo passo

- Não há próximo passo pendente. A correção está mesclada e publicada.
- Publicação verificada em `https://design-draftea.github.io/pulse/`: o bundle `assets/index-BbaUdCmg.css` traz `box-sizing:border-box` em `.open-entries__tabs:before` e em `.buy-betslip__mode-pills:before`, e a medição no artefato real devolve o pseudo-elemento em 104x32 contra o botão `ABIERTAS` em 104x32.
- `.onboarding-series__marker::before` tem o mesmo problema de `box-sizing`: 13x13 declarado, 15x15 renderizado. Como ele é centralizado por `translate(-50%, -50%)`, não desalinha nada, e a ilustração foi aprovada com o tamanho atual. Fica registrado; corrigir é decisão de design, não de bug.


## Histórico: onboarding em bottom sheet (PRs #52 e #53)

- Atualizado em: 2026-09-03
- Agente que entrega: Claude
- Agente esperado a seguir: Claude, na mesma branch, quando os cards 2, 3 e 4 do onboarding chegarem
- Status: concluído — mesclado pelo PR #52 e publicado no GitHub Pages, com a publicação verificada no artefato real. A pessoa usuária autorizou explicitamente push, merge e deploy depois da entrega técnica
- Objetivo: nova feature de onboarding. Um botão de ajuda no subheader, com um pulsante de convite que morre na primeira abertura, e o bottom sheet de onboarding de quatro passos
- Escopo acordado: o botão completo, o bottom sheet e os quatro cards. O onboarding está completo
- Critérios de aceite: botão fiel ao nó `564:5840` e sobrevivendo ao estado compacto do subheader; pulsante visível até o primeiro clique e nunca mais; bottom sheet fiel aos nós `564:6369`, `564:6929`, `564:7019` e `564:7078`, com os quatro `cardAnimado` animados em loop infinito
- Branch: `feature/onboarding`, criada a partir da `main` em `4bf23ff`, commit `2ed956e`, PR #52, mesclada em `00967a6` e removida do remoto

### Acesso ao Figma

- O conector `plugin:figma:figma` (`https://mcp.figma.com/mcp`) exige OAuth e não pode ser autorizado em sessão não interativa.
- A pessoa usuária definiu o MCP do Figma desktop como o caminho padrão: `http://127.0.0.1:3845/mcp`. Registrado com `claude mcp add --scope local`, então foi para o `~/.claude.json` deste projeto e **não** para arquivo versionado.
- Ferramentas de MCP só carregam no início da sessão. Nesta, os nós foram lidos falando JSON-RPC direto com o endpoint. Em sessões novas as ferramentas nativas aparecem sozinhas.

### Leitura do Figma

- O nó `564:5840` é o subheader inteiro. O botão é o `innerHelp` / `iconOnboarding` (`564:6628` e `564:6621`): 20px, `padding: 4px 8px 0`, irmão do bloco de título dentro de `produto`.
- Nenhum token novo. Todos os valores do design já existiam com o mesmo valor: `#191919→#0f0f0f`, `#34d399`, `#f87171`, `rgba(251,251,251,0.5)`, `rgba(251,251,251,0.12)`, `#000` e o gradiente `#4b20ff→#9730ff`.
- O `close` exportado do Figma é byte-idêntico ao `iconClose.svg` do projeto, e o `chevronsUp` tem os mesmos paths do `iconDoubleChevronsUp.svg`. Ambos reutilizados, e o DOWN usa o `iconDoubleChevronsDown.svg` real em vez do truque de espelhar o de cima.
- `get_motion_context` no `cardAnimado` retornou `{"nodes":[]}`: **não existe animação no Figma**. A coreografia foi desenhada nesta tarefa e aprovada pela pessoa usuária.
- O Code Connect do CTA aponta para `draftea_foundation/.../df_button.dart`, o design system em Dart. Não se aplica aqui; o CTA seguiu o padrão dos modais do projeto.

### Decisões

- O botão ficou fora de `.sub-header__details` de propósito. No estado compacto o título colapsa para `max-height: 0`, e dentro de `__details` o botão desapareceria junto com o pulsante que existe para ser achado. A estrutura do próprio Figma confirma: o `innerHelp` é irmão do título, não filho.
- No estado compacto o `padding-top` do botão vai de 4px para 2px, centralizando na linha de 24px da moeda. O Figma não tem essa variante; foi decisão registrada.
- O pulsante pulsa em rajadas de três e descansa, em vez de contínuo: o subheader já tem a moeda girando, o relógio correndo e o `LiveIndicator`. Sob `prefers-reduced-motion` o anel fica **parado e visível** em vez de `animation: none`, porque apagá-lo removeria a única pista de que o onboarding existe.
- O ícone usa o export de glifo da pessoa usuária (`iconOnboading.svg`, com typo no nome) e o círculo vem do token, na mesma declaração `75.115deg` que o ícone de saldo já usa. Assim o gradiente segue o token em vez de ficar congelado dentro do SVG.
- `Seguiente` no Figma foi corrigido para `Siguiente`, autorizado pela pessoa usuária.
- Entrada só pelo botão, sem abertura automática na primeira sessão: decisão de produto da pessoa usuária, para não criar fricção no primeiro contato. A flag fica isolada, então trocar para auto-open é uma linha se a descoberta se mostrar baixa no teste.
- Reabrir sempre recomeça no card 1. São quatro cards e a entrada é um botão de ajuda; retomar no meio confundiria.
- O estado base do CSS do `cardAnimado` é exatamente o quadro estático do Figma, e as animações só sobrescrevem esse estado. É isso que mantém a geometria reservada, sem salto de layout, e faz `prefers-reduced-motion` cair no desenho aprovado.
- As posições horizontais do card viraram frações do vão de 279px do Figma, porque o design é fixo em 375px e o protótipo vai até 499px.
- As linhas tracejadas viraram `repeating-linear-gradient` em vez do SVG exportado: o export sai com `preserveAspectRatio="none"` e esticaria o passo de 3.66px junto com a largura.
- O `blur` do brilho do topo ficou nos 50px que o design especifica. Houve uma tentativa de reduzir para 25px, por analogia com o `stdDeviation="28"` do export de `light`; comparado com o render do Figma, 25px concentra a cor numa faixa dura e 50px reproduz o brilho largo. Revertido.

### Defeitos do card animado, reportados pela pessoa usuária e corrigidos

- **A curva não esticava.** O `<svg>` é elemento substituído: com `left` e `right` absolutos e `width: auto`, o CSS usa a largura intrínseca dele — a proporção do viewBox contra os 92px de altura, ~273px — e ignora o `right`, em vez de esticar como uma `div` faria. Em 375px o vão é 279 e passava desapercebido; em qualquer largura maior a curva parava em ~72% do card e a ponta ficava 79px atrás da bolinha. A bolinha sempre esteve na posição correta do design. Corrigido declarando `width: var(--onboarding-chart-span)`.
- **Um ponto piscando no canto superior direito.** Parada em `stroke-dashoffset: 1` a curva não desenha nada, mas o padrão de tracejado faz o traço seguinte começar exatamente na posição final do caminho, e o `stroke-linecap: round` do design pinta a tampa redonda dele ali. Ficava visível nos 0,42s de espera de cada volta. Corrigido deixando a curva transparente enquanto está parada, com a opacidade entrando em 9%, quando o traço já tem comprimento.
- **O desenho passou de `ease-in-out` para `linear`.** Com easing o começo era tão lento que o traço ficava sub-pixel por um instante e a tampa redonda parecia um ponto parado, agora na origem da linha. `linear` também lê melhor: a série representa o tempo da rodada avançando, e velocidade constante é o certo para isso.
- **A pílula `Terminó arriba` derivava em relação à bolinha.** A largura dela é de texto, ~95px fixos em qualquer tela, e o lado esquerdo estava preso a uma fração do vão. A folga até a bolinha é `vão × 0,369 − 95`: sobrava vazio em telas largas e, abaixo de 257px de vão (~353px de tela), ficava negativa e a pílula passava por cima da bolinha, escondendo-a. A pílula passou a ser ancorada pela borda direita, 8px antes da bolinha, que é a distância do Figma — a largura do texto sobra para a esquerda, onde há espaço. A linha verde foi ancorada do mesmo jeito, terminando rente à borda direita da pílula, que a cobre.

### Card 1 redesenhado no Figma (`564:6653`) e o marcador do gráfico real

A pessoa usuária refez a ilustração do card 1. O que mudou no nó:

- A curva lisa antiga (`564:6902`) está `hidden="true"` no Figma. Entraram `line` (`603:7451`, 279x106 em 32,1, traço de 3px) e `degrade` (`603:7449`, 279x115 em 32,1), uma série irregular com área em degradê branco a 16% por baixo.
- A série agora termina **plana no topo**, e a linha verde do nível final desceu de `top: 10.06` para `14.06`. A pílula desceu de `top: 1` para `5`, e o ponto de `top: 6` para `10`.
- O ponto exportado virou branco (`#FBFBFB`), era verde.

Além disso a pessoa usuária pediu duas coisas: usar **o mesmo marcador do gráfico real** e que a série só precisa parecer real, sem ser o desenho exato do Figma.

#### Como a animação foi refeita

- `stroke-dashoffset` não serve mais: com área preenchida, traçar só a linha deixaria o degradê aparecendo de uma vez. A revelação passou a ser um **recorte que varre da esquerda para a direita** (`clip-path: inset()`), que revela linha e área juntas e lê como o tempo da rodada avançando. De brinde, morreu o problema da tampa redonda degenerada que existia no `dashoffset`.
- O marcador é o do `PriceChart`: halo de r=10 com o preenchimento e o traço de lá, anel de r=6.5 com miolo `#111`, e o ponto branco de r=3. Feito em camadas de CSS, e não em SVG, porque precisa manter 20px fixos enquanto viaja sobre uma série que estica com a largura da tela.
- O pulso ambiente do halo do gráfico real ficou de fora de propósito: seria um terceiro loop fora de fase com o do card, e aqui o marcador já está em movimento, o que comunica `ao vivo` por si.
- **O marcador viaja na ponta da varredura.** O `left` avança na mesma janela (8% a 48%) e no mesmo `linear` do recorte; o `top` segue a série, amostrada em **41 pontos igualmente espaçados em x** — densidade escolhida por causa da subida quase vertical entre 80% e 85% do eixo, que 20 pontos cortariam em diagonal. A amostragem foi feita avaliando as dez cúbicas do caminho em Python (`scratchpad/sample.py`), não a olho.
- A viagem é o único movimento que **não** sai por multiplicação do `--onboarding-motion`: são 41 paradas em lugares diferentes, sem expressão que as colapse. Então card 1 tem um `@media (prefers-reduced-motion: reduce)` só para trocar a animação do marcador pela versão sem viagem, deixando-o parado no fim da série — que é onde ele descansa de todo jeito.
- `onboardingChartDot.svg` deixou de ser usado e foi removido; entraram `onboardingChartLine.svg` e `onboardingChartArea.svg`.

#### Dois defeitos reportados na revisão e corrigidos

- **O topo do gráfico saía cortado.** `clip-path: inset()` corta nas quatro bordas da caixa, e a imagem da série passa 1,5px acima dela por causa do traço de 3px — então o pico da série era raspado pela varredura. Corrigido com `--onboarding-chart-plot-slack: 8px`: a caixa do plot cresce 8px em cima e embaixo e os filhos são deslocados pela mesma folga, mantendo a área em `top: 1px`. A varredura é só horizontal, então crescer na vertical não muda a conta do recorte. Medido depois: a imagem passou a sobrar 6,5px dentro do plot.
- **O marcador tinha preto.** O anel do gráfico real usa miolo `#111`, que existe lá para furar a linha que passa atrás dele. Sobre o card isso lê como um disco preto. Trocado pelo mesmo branco translúcido do halo (`rgb(251 251 251 / 0.08)`) — valor que já vem do próprio gráfico, não inventado. Somado ao halo por baixo, o miolo levanta do fundo. Conferido nas três camadas: nenhuma tem preto.
- Conferido em imagem no quadro do pico, que é onde o corte aparecia: a série sobe inteira e o marcador pousa nela.

#### Revisão do gráfico animado, a pedido da pessoa usuária

Três mudanças, todas medidas antes de decidir.

- **O marcador descolava até 5,92px da série.** As 41 paradas eram igualmente espaçadas em x, e entre elas o marcador interpola em reta — no trecho mais íngreme (x=80,8%) a reta cortava por dentro da curva. Pior: esse é exatamente o trecho que mais importa. Reamostrado **por curvatura**, com subdivisão adaptativa até o erro cair abaixo de 0,8px: ficaram **36 paradas** (menos que antes) e o erro máximo em **0,78px**.
- **A travessia do objetivo não era marcada.** A série cruza a linha do `PRECIO OBJETIVO` em x=81% do vão, aos 39,5% do ciclo — o instante que transforma `precio objetivo` em `terminó arriba`, e nada o reconhecia. Agora a linha do objetivo pisca em branco cheio (um `::after` com o mesmo tracejado em `--color-fill-primary`) e o marcador dá um ping de escala, os dois no mesmo instante.
- **O ritmo era invertido:** 1,68s nos primeiros 80% do vão, onde nada decide, e 0,4s nos últimos 20%, que carregam tudo. A primeira tentativa foi uma pausa de 5% do ciclo na travessia; a pessoa usuária pediu para tirar, e ela saiu. **O ritmo passou a vir do desenho da série** (ver abaixo): com a travessia em 54% do vão em vez de 81%, sobra quase um segundo depois dela sem nenhum truque de tempo. Foi a melhor solução das três — corrigir o conteúdo em vez do relógio.

#### A série foi refeita em código

A pessoa usuária não gostou de como o gráfico estava desenhado e liberou não seguir o Figma. O que estava errado no desenho anterior: a primeira metade era uma curva lisa e arredondada, que lê como traço à mão e não como preço, e havia um pico quase vertical implausível, seguido de uma cauda horizontal artificial.

- A série agora é **gerada em código** e vive em `src/assets/onboardingChartSeries.svg`, com **linha e área no mesmo SVG** — como arquivos separados eram dois mapeamentos de coordenada que podiam divergir.
- A primeira tentativa foi uma polilinha crua de 141 pontos com ruído em três escalas. **Ficou irregular demais** e a pessoa usuária pediu algo mais suave. A versão final são **26 pontos de âncora suavizados com a mesma fórmula do gráfico real**: Béziers cúbicas com alças horizontais em `0,45 × dx`, exatamente o `getSmoothPath` do `PriceChart`. Uma onda branda mais um tremor pequeno por ponto; a suavização transforma isso em ondulação em vez de bico.
- Métrica usada para julgar a suavidade: **4 reversões de inclinação em 25 segmentos**, contra dezenas na versão crua.
- O marcador foi reamostrado por **redução Douglas-Peucker** com tolerância de 0,8px: **30 paradas, erro máximo de 0,76px**. A curva suave precisou de menos da metade das paradas da versão irregular (que dava 68 a 1,19px) e ainda rastreia melhor.
- Restrições verificadas na geração: uma única travessia entre 50% e 62% do vão, folga de pelo menos 1,5 ao objetivo **medida a partir de 5% depois da travessia** (medir logo após ela não diz nada: por continuidade y ainda vale ~48 ali, e essa foi uma verificação que eu escrevi errado na primeira vez e que rejeitou 600 sementes até eu perceber), caber no viewBox e terminar exatamente no nível da linha verde.
- Se você quiser levar essa série de volta para o Figma, o caminho está no `d` do SVG e o gerador em `scratchpad/serie.py`.
- Cuidado registrado: ao reescrever o CSS eu apaguei a regra do `.onboarding-chart__plot` sem perceber, porque ela estava no meio do trecho substituído. O sintoma foi a varredura sumir (recorte sempre em 100%) e a geometria sair 8px fora. Só apareceu porque a medição compara contra os números do Figma.

Duas recomendações minhas foram **descartadas depois de pensar melhor**, e ficam registradas para não voltarem por engano:

- **Fazer o `67%` e o `33%` se mexerem durante a animação.** Eu propus, argumentando que plantaria a lição do card 3. Mas o card 1 tem uma mensagem só — `você escolhe uma direção` — e trazer preço para dentro dele dilui isso, além de competir com o gráfico pela atenção na mesma janela. O card 3 ensina preço no lugar certo.
- **Uniformizar as durações dos três cards.** Cada duração segue o que o conteúdo do card pede: forçar um valor comum ou apressaria a conta do card 3 ou encheria o card 1 de espera.

### Card 4 — `onboarding-04` (564:7078) e a série extraída

- Conteúdo: `Puedes vender antes` / `Si cambias de idea, vendes tu entrada al valor del momento sin esperar a que termine la ronda.` O CTA do último passo é `Entendido, empezar`, como o Figma nomeia.
- A ilustração tem a pílula vermelha `DOWN - 67%`, `Participaciones: 200`, a série numa caixa mais baixa (279x74 em `top: 30`) e um rodapé com `Ganancia potencial:` e o botão `Vender` de 120x32.
- A pessoa usuária pediu **o mesmo gráfico do card 1**, então a série virou o componente compartilhado `OnboardingSeries`: varredura, série e marcador, com a caixa entrando por `--onboarding-series-top` e `-height`. As paradas do marcador são **frações da caixa**, e é isso que permite as mesmas keyframes servirem ao card 1 (115px em `top: 1px`) e ao card 4 (74px em `top: 30px`).
- Card 1 foi refatorado para usar o componente e conferido contra os números que já estavam medidos: os `y` do marcador batem exatamente (93, 85,1, 48,8, 14,1) e as porcentagens reveladas também (0, 30, 56,5, 100).
- O ping de escala do marcador na travessia saiu nessa extração: o marcador agora é compartilhado, e somar uma terceira animação nele do card 1 exigiria repetir a lista inteira. O flash na linha do objetivo continua, e marca no elemento certo.
- A linha `Participaciones:` é ancorada pela **direita**, não pela esquerda: largura de texto presa a uma fração do vão derivaria da borda — a mesma lição da pílula do card 2.

#### A interação do botão `Vender`

A pessoa usuária pediu que algo acontecesse no clique, sem dizer o quê. O que foi feito faz o texto do card virar gesto:

- Antes da venda, a **ganancia corre junto com a varredura**: o número sobe enquanto a rodada avança, escravizado ao relógio da animação CSS pelo mesmo mecanismo do card 3.
- **Depois da varredura o número segue oscilando de leve** em torno do valor, porque a rodada continua viva. Sem isso, metade do ciclo é pausa e um toque ali congelaria um valor já imóvel — a demonstração falharia em metade das vezes. Verificado: 14 amostras distintas ao longo de um ciclo inteiro, sem nenhuma repetição.
- No clique, tudo congela **no instante do toque**: a série para de ser traçada, o marcador para onde estava, o valor trava, o rótulo deixa de ser `potencial` e vira `Ganancia:`, o botão fica verde com `Vendido`, e uma linha tracejada vertical marca em que ponto do tempo aquilo aconteceu — a posição vem do `left` do marcador, escrita em `--onboarding-sell-at` no clique.
- O congelamento é `animation-play-state: paused`, então a animação retoma exatamente de onde parou. Depois de 2,2s o card volta a rodar, para o loop seguir ensinando.
- O botão é um `button` de verdade, alcançável por teclado, com as camadas decorativas em `aria-hidden` individualmente — o card 4 é o único que não pode ser inteiramente `aria-hidden`.

#### O gráfico invertido e o valor da venda

Houve três passos aqui, e vale registrar o raciocínio porque as duas primeiras versões estavam erradas.

**Primeira versão:** valor fixo de `$588.24`, como o Figma. Registrei que era impossível com 200 participações a 67¢ — o ganho máximo é ~$66.

**Segunda versão:** a pessoa usuária pediu que o valor caísse conforme o preço passa do objetivo, porque a posição é DOWN, e que considerasse as participações. Implementei lucro/prejuízo saindo da altura da linha. A aritmética ficou certa e **a narrativa ficou errada**: o card passou a ensinar um prejuízo, com `Pérdida potencial` na maior parte do ciclo. O card existe para apresentar a saída como vantagem, não para assustar no primeiro contato. E o sinal estava na cara desde o começo — o Figma tem rótulo `Ganancia potencial` com número positivo, ou seja o desenho previa uma posição **ganhando**; só o gráfico contradizia, porque foi copiado do card 1.

**Versão final**, decidida com a pessoa usuária:

- **A série do card 4 é invertida**: começa acima do preço objetivo e termina abaixo. Com a posição em DOWN, é a queda do preço que faz a entrada valer mais. Gerada pelo mesmo gerador e suavizada com a mesma fórmula do gráfico real; travessia em 57,7% do vão, 2 reversões de inclinação em 25 segmentos.
- `OnboardingSeries` ganhou uma prop `direction`: `rising` para o card 1 e `falling` para o card 4, com uma tabela de paradas do marcador para cada uma. Mesmo método de redução, tolerância de 0,8px, erro máximo de 0,77px.
- **O número passou a ser o valor da venda**, não lucro nem prejuízo: `participações × preço do DOWN`, que sobe de **$24 a $180** ao longo da rodada. Rótulo `Valor de venta:` antes e `Vendido por:` depois. Sem sinal, sem vermelho, sem `Pérdida` em lugar nenhum.
- Dois motivos para não mostrar resultado aqui. Um: apareceria `Pérdida potencial` na maior parte do ciclo. Dois, mais sutil: **com a posição ganhando, segurar até o fim pagaria $200 e vender antes paga $180** — o resultado ensinaria que vender custa dinheiro. O texto do card já diz qual é o benefício, `vendes tu entrada al valor del momento sin esperar`: é não esperar, não otimizar. E valor de venda é o que uma tela de venda real mostra primeiro.
- O preço de entrada de 67¢ não entra na conta do valor da venda, mas ficou como constante ligada ao texto da pílula, para os dois números não divergirem.
- **A venda automática passou para o fim da varredura** (48% do ciclo), a pedido da pessoa usuária: vende quando a barra chega ao fim do gráfico, que é onde o valor está no máximo. O botão continua clicável.
- Defeito encontrado e corrigido no caminho: `armed` e a fase anterior eram variáveis locais do efeito, e o efeito remonta quando `isSold` volta a `false` — então rearmava com a fase ainda dentro da janela do gatilho e vendia de novo na hora, num laço que nunca terminava a volta. Passaram para refs.

### Refinamentos de movimento pedidos na revisão

- **Depois de vender, a série é remontada em vez de retomada.** Retomar deixava o gráfico voltar a ser traçado depois da venda, como se a posição ainda estivesse aberta, e a volta demorava a fechar. Agora cada volta é uma rodada completa: corre, vende, segura dois segundos, recomeça do zero. Feito trocando a `key` do `OnboardingSeries`, o que remonta o elemento e reinicia as animações. Medido: o valor sobe de `$24` a `$177` conforme a varredura vai de 15% a 100%, vende, segura, e reinicia em `rev=0` com `$27`.
- **A troca de passo deixou de ser seca.** Palco de transição no mesmo vocabulário das rotas do `ProfileBottomSheet`: 300ms `ease-out` em `transform` e `opacity`, deslizando no sentido da navegação. Uma diferença: lá as rotas são todas absolutas num palco de altura fixa; aqui o conteúdo tem altura automática, então só a camada que **sai** fica absoluta e a que entra permanece no fluxo, definindo a altura. Só o passo atual fica montado em repouso, para não deixar quatro ilustrações animando ao mesmo tempo. O deslocamento é multiplicado por `--onboarding-motion`, então com a preferência ligada a troca vira dissolvência.
- Cuidado registrado: os efeitos colaterais da transição estavam **dentro do updater do `setStepIndex`**. O React pode invocar um updater mais de uma vez, e agendar temporizador ali dispararia a limpeza antes da hora. Passaram para fora.
- **O botão `Vender` gira para `Vendido`.** Duas faces no mesmo botão com `preserve-3d` e `backface-visibility: hidden`, girando 460ms. O nome acessível vem de um `aria-label`, senão o leitor de tela anunciaria as duas faces. Com `prefers-reduced-motion` as faces trocam por dissolvência em vez de girar, porque girar é movimento.
- **A barra de progresso do card 2 entra por dissolvência.** Ela nascia em `opacity: 1` e aparecia seca na virada do loop, enquanto o resto do card entrava suave. Agora usa os mesmos 6% de entrada do `onboarding-clock-transient`. Medido: 0,5% → 0,01; 3% → 0,50; 6% → 1,00.

### Textos em espanhol escritos por mim, para revisão de um nativo

O Figma trouxe a maior parte das strings. Estas eu escrevi, e valem uma conferida por quem fala espanhol antes do teste no México: `Terminó abajo`, `Valor de venta:`, `Vendido por:`, `Vendido`, `Volver`, `Cerrar` e `Paso X de 4`. Também corrigi `Seguiente` para `Siguiente`, que era erro de digitação no Figma.

### Desvio proposital do Figma no card 1: `DOWN 33%`

O nó do Figma traz `UP 67%` e `DOWN 34%`, somando 101. Por decisão da pessoa usuária o card passou a mostrar `33%`, para o par somar 100 e não virar um enigma no meio da onboarding.

**Isso não é correção de um erro do design.** Na tela real os dois percentuais saem de livros de ordens independentes: `useOutcomeMarket` chama `getDisplayedOutcomePrice()` separadamente para `books.up` e `books.down`, e essa função devolve o ponto médio de cada livro. Dois pontos médios apurados em livros distintos ficam próximos de 100, não exatamente 100 — a diferença é o spread do mercado, e passar de 100 não é defeito. A contingência local é o único lugar onde o par é complementar (`marketFallback.ts` faz `down: 1 - up`), e mesmo lá o arredondamento independente de cada lado devolve 67/34 quando `up` vale 0,665.

Consequência aceita: a onboarding ensina um par que soma 100, enquanto a tela ao vivo pode mostrar 101. Está registrado em comentário no `OnboardingChart.tsx` para ninguém "alinhar de volta" com o Figma sem saber. Nada foi mudado no cálculo do mercado.

### Card 2 — `onboarding-02` (564:6929) e o botão de voltar

- Conteúdo: `Cada ronda dura 15 minutos` / `Cuando el reloj llega a cero, el precio final define el resultado. No hay nada más que hacer: se resuelve solo.`
- A ilustração é o subheader da rodada em miniatura (logo, `BTC / 15 Min` a 20px em vez de 24px, faixa de horário sem data), uma barra de progresso e os dois cards de preço.
- Reúso: `logoBTC.png`, `arrowUpGreen.svg`, `arrowDownRed.svg` e `onboardingChartGlow.svg` já existiam. O ícone do chip exportado do Figma é idêntico ao `arrowUpGreen.svg` do projeto.
- Botão de voltar: 48x48 com ícone de 16px, no footer de 343 (48 + 8 de gap + 287). No Figma o rótulo dele está `hidden="true"` — o `label="Seguiente"` que aparece no Code Connect é resto do componente do design system, não um rótulo visível. Só aparece a partir do passo 2.
- O `iconVoltar.svg` do projeto tem a seta recuada numa caixa de 40x40, ocupando 45% dela, então é renderizado a 32px para o glifo dar os ~14px do design.

#### A decisão do 00:00

A pessoa usuária propôs tirar os dois preços e pôr uma mensagem. A contraproposta aceita foi outra: os dois preços **ficam**, porque a comparação entre objetivo e final é a própria lição do card — apagá-la no instante em que ela acontece removeria a evidência. Em vez disso:

- O card da direita troca `Precio actual` por `Precio final` e o preço congela.
- A barra é que cede lugar: chega a 100%, sai de cena inteira (trilha incluída) e a pílula `Terminó arriba` aparece no lugar dela. O que estava contando passa a anunciar, e não precisa de espaço novo.
- A pílula repete o visual da do card 1 de propósito, para os quatro cards lerem como um sistema.
- O preço atual cruza o objetivo três vezes antes de fechar, com o chip trocando de seta e cor. Se o preço só subisse, a rodada pareceria decidida desde o começo, e é isso que faria `se resuelve solo` soar falso.
- A contagem é comprimida para ~2,7s, não 5s literais: cinco segundos olhando um relógio é lento num card em loop, e assim cada volta fica nos mesmos 5,2s do card 1.

#### Duas voltas alternadas

Pedido da pessoa usuária, e pelo mesmo motivo do cruzamento de preço: a primeira volta fecha **acima** do objetivo e a segunda **abaixo**, e aí o ciclo recomeça. Uma volta só, sempre terminando acima, faria o resultado parecer combinado.

- Ciclo completo de 10,4s, duas voltas de 5,2s. `--onboarding-clock-cycle` é derivada de `--onboarding-clock-duration`, então mexer numa mexe na outra.
- A volta 2 fecha em `$80,189.64`, `↓ $6`, com a pílula `Terminó abajo` no vermelho de baixa (`--color-fill-error`) — a mesma linguagem do DOWN no resto do app.
- Implementação: em vez de tiras de doze fatias com duas janelas de `steps()`, cada volta tem a própria tira de seis e um invólucro `.onboarding-clock__run--a/b` alterna qual está em cena, num ciclo de 10,4s. As duas ocupam a mesma célula de um grid, então a caixa mede a maior e a troca não empurra nada.
- A troca acontece exatamente na virada de cada volta, quando `onboarding-clock-transient` já levou o conteúdo a `opacity: 0` — verificado: em 5,19s as duas pílulas estão em 0.
- A pílula perdeu o posicionamento para um `__outcome-slot`: o slot cuida da posição e de qual volta está em cena, a pílula cuida da própria entrada. Sem isso, duas animações disputariam `opacity` no mesmo elemento.

#### Como a contagem é feita

- Três odômetros — segundos, diferença e preço — são tiras verticais de seis fatias com `overflow: hidden`, movidas por `steps(6, jump-none)`. Compartilham keyframes e duração, então ficam sincronizados por construção, sem nenhum temporizador em JavaScript e sem re-render do React a cada segundo.
- Os valores terminam todos em `.64`, como o objetivo, para a diferença fechar em dólares inteiros e o último passo cair exatamente no par do Figma: `$80,202.64` e `$7`.
- O relógio mostra `00` cerca de 0,45s antes de a barra fechar. Isso é correto: `00` é o que um relógio exibe durante o último segundo, e a barra completa no zero de verdade.

### Card 3 — `onboarding-03` (564:7019)

- Conteúdo: `El % indica el precio` / `Con $10 a 67¢ recibes 14.93 participaciones. Si aciertas, cada una paga $1.`
- A ilustração é a decomposição de uma compra: duas pílulas verdes no topo (`COMPRA UP` e `67%`) e um grid de duas colunas por três linhas com `Monto a invertir $10`, `Precio por participación 67¢`, `Si aciertas, recibes $14.93`, `Ganancia +$4.93` e a conta `$10 ÷ 67¢ = 14.93 participaciones`.
- Nenhum asset novo: só o glow, que já existia.
- A pílula `67%` está em x=173 no Figma, que é exatamente onde começa a segunda coluna do grid (32 + 140.5) — ela fica alinhada sobre a coluna `Precio por participación` de propósito, porque é o que o título do card diz. Por isso está ancorada nessa coluna, `calc(inset + (span + 2px) / 2)`, e não numa fração solta do vão.
- O texto da conta na última linha tem 177px e a coluna mede 138.5, então ele transborda por cima da segunda coluna. É assim no design; `minmax(0, 1fr)` nas colunas é o que impede o grid de esticar para acomodá-lo.

#### A animação

O conteúdo é uma conta, então a animação é a **derivação** dela, em ordem de leitura: a compra, o preço, o valor investido, o preço por participação, o retorno com os números crescendo, e **por último** a linha `$10 ÷ 67¢ = 14.93 participaciones`, que fecha o raciocínio. Cada bloco sobe 4px ao entrar; as duas células do retorno entram juntas, porque são um só beat.

A pílula `67%` recebe uma ênfase de escala em 25% do ciclo, exatamente quando o `67¢` aparece. É a ligação que o título do card afirma — o percentual é o preço — e é o único momento de destaque da animação.

- Ciclo de **7,8s**, mais longo que os 5,2s dos outros cards: são seis beats em sequência e o conteúdo é uma conta, que precisa de tempo de leitura. A pausa no quadro cheio vai de 58% a 92%, uns 2,6s.
- Os números de `Si aciertas, recibes` e `Ganancia` crescem de zero até o valor, no mesmo `ease-out` quártico (`1 - (1 - t) ** 4`) do contador de métricas do `ProfileBottomSheet`.
- **A contagem é escrava do relógio da animação CSS**, lido por `getAnimations()` e não por `performance.now()`. O motivo é a armadilha registrada abaixo: o Chrome congela animações de página não renderizada, então um relógio próprio dessincronizaria da ilustração toda vez que a aba fosse para o fundo. O `requestAnimationFrame` também para junto, então a contagem custa nada com a aba oculta.
- O texto é escrito direto no DOM por `ref`, sem estado do React, para não re-renderizar o sheet a cada quadro.
- A duração e a janela da contagem (`--onboarding-shares-count-from` e `-to`, 35% a 50%) vivem no CSS junto das keyframes, e o componente as lê. Um só lugar para ajustar o tempo.
- Sem a animação-relógio, o contador cai no **valor final**, não em zero: é o estado base do card. Só acontece se as animações forem desligadas por fora; sob `prefers-reduced-motion` o efeito não inicia e o valor final do JSX permanece.

### Correção de fidelidade nos dois cards

- No Figma a borda dos cards é desenhada **por dentro** da medida, então com `box-sizing: border-box` o `padding: 16px` empurrava tudo 1px e deixava a área da ilustração com 154px em vez de 156. Passou para `padding: 15px 0` nos dois cards de 188px, e `7px 11px` nos cards de preço de 58px. Card 1 ficou mais fiel também: área interna 156 a 16px da borda.

### `prefers-reduced-motion`: as ilustrações continuam em loop, sem movimento

A pessoa usuária reportou duas vezes que a ilustração não animava — primeiro o card 2, depois o card 1 —, com capturas que eram exatamente o quadro base de `prefers-reduced-motion`. Nas duas vezes a animação foi verificada rodando aqui (cinco animações avançando 900ms em 900ms, `dashoffset` mudando, a preferência em `false`), então a causa mais provável é a preferência ligada no sistema dela.

O tratamento anterior desligava a animação inteira, e isso estava errado de origem: **a preferência pede menos movimento — deslocar, escalar, girar —, não menos mudança.** E aqui a ilustração é o conteúdo do card, não enfeite: desligá-la tirava a explicação de quem tem a preferência ligada.

A correção é uma variável só, `--onboarding-motion`, definida em `.onboarding-sheet` como `1` e zerada dentro do `@media (prefers-reduced-motion: reduce)`. As keyframes dos três cards multiplicam deslocamento e escala por ela, então zerá-la remove o movimento e mantém o loop:

- Card 1: a série aparece por opacidade em vez de se desenhar; pílula, ponto e linha do resultado perdem a escala. `stroke-dashoffset: calc(1px * var(--onboarding-motion))` — **com unidade**, porque `calc()` com número puro não vale em contexto de comprimento e a keyframe inteira cairia em silêncio.
- Card 2: a pílula do resultado perde a escala. Os odômetros continuam rodando: `steps()` troca os dígitos de uma vez, é texto mudando e não deslocamento. A barra de progresso também fica, pelo mesmo critério de qualquer carregamento.
- Card 3: os blocos entram sem subir os 4px e a ênfase da pílula `67%` perde a escala. A contagem crescente continua, e o `OnboardingSharePrice` deixou de sair cedo quando a preferência está ligada.
- O deslizar do próprio bottom sheet segue reduzido a 1ms com a preferência ligada: aquilo é movimento de verdade.

Verificado nos dois estados, simulando a preferência ao zerar a variável — que é o mesmo que o `@media` faz. Com movimento: `dashoffset` 0,7 → 0,45 → 0, ponto em escala 0,3, pílula em 0,85, bloco do card 3 deslocado 2,49px, ênfase em 1,12. Sem movimento: `dashoffset` sempre 0, todas as escalas em 1, deslocamento em 0 — e a mesma contagem de animações declaradas nos dois casos, ou seja o loop não para.

### Duas armadilhas do ambiente, para a próxima sessão não perder tempo

- **O painel do browser fica `hidden` com frequência**, e página não renderizada tem a timeline do documento congelada no Chrome. Sintomas: `Animation.currentTime` parado em 0 com `playState: "running"`, e `screenshot` devolvendo quadros idênticos ou desatualizados. Confirmar com `document.visibilityState` e medir `document.timeline.currentTime` antes de concluir que alguma animação quebrou. Com `tabs_select` a aba avança normalmente — verificado, 800ms em 800ms.
- **`pause()` via Web Animations API é desfeito** quando o painel troca de visibilidade. Para travar uma fase de forma estável, injetar `animation-play-state: paused` e `animation-delay` negativo por CSS, ou `animation: none` para obter o estado base.

### Bug encontrado e corrigido

- A devolução de foco ao fechar o sheet não funcionava: o foco ia para o `body` em vez de voltar ao botão que abriu.
- Causa: `onClose` derruba o `inert` do conteúdo principal num commit do React sem ordem garantida em relação ao próximo quadro. Enquanto o `inert` está no DOM, `focus()` é ignorado em silêncio.
- Correção: `restoreFocus` insiste por até seis quadros, até o foco pousar. O `ProfileBottomSheet` tem o mesmo `requestAnimationFrame` único e provavelmente a mesma corrida — não verificado, e fora do escopo desta tarefa.

### Arquivos alterados

- `src/components/SubHeader/SubHeader.tsx` e `.css` — o botão, a geometria do Figma, o halo em rajadas, o estado compacto
- `src/hooks/useOnboardingInvite.ts` — flag do convite em `localStorage` e `?resetOnboarding=1`
- `src/components/OnboardingBottomSheet/` — `OnboardingBottomSheet.tsx`/`.css`, `OnboardingChart.tsx`/`.css`, `onboardingSteps.ts`, `index.ts`
- `src/assets/onboardingChartGlow.svg` e `onboardingChartDot.svg` — exports do Figma
- `src/App.tsx` — estado, handlers, `inert` e render do sheet
- `src/assets/iconOnboading.svg` é export da pessoa usuária, não versionado ainda, com typo no nome. Renomear depende de autorização

### Validações

- `pnpm lint` limpo e `pnpm build` sem erros.
- Suíte completa passando, 93 testes: `test:chart` 26, `test:market` 25, `test:wallet` 19, `test:entries` 8, `test:fallback` 6, `test:assets` 3.
- Navegador em `localhost:5176`, viewport 375x812: botão fiel ao Figma (36x48, ícone 20x20 a 4px do topo); halo rodando `8s infinite`; clique derruba a classe, zera as animações e grava a flag; após reload o pulsante não volta; no estado compacto o título colapsa e o botão continua visível.
- Bottom sheet: `role="dialog"`, `aria-modal`, 4 bullets, CTA `Siguiente`, título e corpo corretos em cada passo.
- Navegação entre os passos: passo 1 mostra o gráfico e nenhum botão de voltar; avançar leva ao passo 2 com o relógio, o botão de voltar e o segundo bullet ativo; voltar retorna ao passo 1 e o botão de voltar desaparece.
- Card 2 conferido contra o Figma com a animação parada: card 188 e área interna 156 a 16px da borda, `tempo` em 32,0 com 48 de altura, título do mercado em x=52, relógio com 77 de largura encostado à direita, barra em 32,71, cards de preço em 32,98 com 58 de altura e o rótulo em 12,8 dentro deles.
- Fases do card 2, medidas: 3% parado em 00:05 com a barra em 0 e os valores entrando; 10% barra em 8%; 25% em 00:03 com 37%; 40% em 00:02 com 65%; 55% em 00:00 com 94%; 58% barra em 100%; 62% rótulo já em `Precio final`, barra saindo e pílula entrando; 70% barra fora e pílula inteira; 88% segurado; 98% tudo desaparecido para a virada do loop.
- Card 1 com `UP 67%` e `DOWN 33%`, somando 100.
- Card 4 conferido contra o Figma, em vão de 374: pílula em 32,0 com 20 de altura; `Participaciones` terminando na borda direita do vão; série em 32,30 com 74 de altura; linha do objetivo em y=75; rótulo em 32,57; rodapé em 32,110; botão de 120x32 encostado à direita.
- Interação do `Vender` medida: o valor acompanha a altura da linha — `$22` quando o preço está bem acima do objetivo, `$55`, `$95` no objetivo, `$175` a `$180` quando fecha abaixo. A venda automática dispara no fim da varredura, em torno de `$180`, com o rótulo virando `Vendido por:`, o botão verde `Vendido`, as animações em `paused` e a linha do momento na posição do marcador. **Nenhuma amostra trouxe `Pérdida` ou número negativo.** Depois de 2,6s tudo retoma; uma venda por volta.
- Não validado em imagem: o estado vendido. A captura do painel fica sempre um estado atrás nas mudanças do React, e a janela de 2,6s não dá margem — está verificado por medição (`Vendido por: $183,65`, botão `Vendido`, desabilitado). As capturas que saíram mostram bem as duas mudanças visíveis: a série invertida e o rótulo `Valor de venta`.
- Card 1 redesenhado conferido contra o Figma com a animação parada, em vão de 374: área e linha em 32,1 com 115 e 106 de altura, linha verde em y=14,1, pílula em y=5, escolhas em y=124, marcador de 20px.
- Varredura medida: 4% recorte em 100% e nada visível; 15% em 82,5%; 30% em 45%; 48% em 0% e completa; 95% desaparecendo. Com `--onboarding-motion` em zero o recorte nasce em 0% e o gráfico aparece por opacidade, mantendo o loop.
- **O marcador acompanha a ponta da varredura**, conferido em imagem no meio dela: pousa exatamente na ponta do traço. Erro máximo contra a série medido em 0,78px depois da reamostragem por curvatura.
- Coreografia da série final, medida fase por fase: 8% varredura em 0 e marcador na base (y=93); 20% revelado 30% e y=85,1; **30,6% revelado 56,5% com o marcador em y=48,8 — a linha do objetivo está em y=49, então ele pousa sobre ela — flash em 0,63 e ping em 1,245**; 31,6% flash no pico de 0,89 e ping em 1,346, com a varredura já em 59% (contínua, sem pausa); 37% flash de volta a 0 e revelado 72,5%; 48% revelado 100% e marcador em y=14,1, o mesmo nível da linha verde; 62% linha verde e pílula em 1; 88% quadro cheio.
- Série em `top: 1px` da área de animação com 115px de altura, e a caixa da varredura em `-7px` por causa da folga — conferido.
- Caminho de `prefers-reduced-motion` do marcador conferido: sem viagem, parado em x=309, que é o fim da série.
- Os seis passos do chip da volta 1 conferidos um a um: setas vermelhas para baixo em 00:05 e 00:03, verdes para cima nos outros quatro, com as cores dos tokens `--color-fill-error` e `--color-fill-success` e os preços coerentes com o objetivo. Volta 2 conferida do mesmo jeito: verde em 00:05 e 00:03, vermelho nos outros quatro, fechando abaixo.
- Card 3 conferido contra o Figma com a animação parada, em vão de 374: grid em 32,37 com 118 de altura, colunas de 186 (metade do vão menos os 2px de gap), linhas em 37, 87 e 137, célula da conta com 18 de altura, e a pílula `67%` em x=220 — o mesmo x do início da coluna 2, portanto alinhada a ela.
- Fases do card 3 no ciclo de 7,8s, medidas: 20% o retorno ainda fora e os números em `$0.00`; 30% o retorno entrando (0,43); 35% o retorno dentro e a contagem começando; 40% em `$11.98` e `+$3.96`; 45% em `$14.75` e `+$4.87`; 50% fechando em `$14.93` e `+$4.93`; 55% a conta entrando (0,81) — **depois** do retorno, como pedido; 62% a conta dentro; 85% tudo ainda no quadro cheio, a pausa longa; 92% em diante desaparecendo junto para a virada.
- Fallback do contador conferido: com as animações desligadas por fora, `getAnimations()` devolve zero e os valores ficam em `$14.93` e `+$4.93`, não em zero.
- Navegação até o passo 3: bullet 3 ativo, título e corpo corretos, botão de voltar presente.
- Ciclo de duas voltas medido ao longo dos 10,4s: volta A em cena de 0 a 5,2s com `Terminó arriba` a 0,994 em 4,6s; em 5,19s as duas pílulas em 0, que é a janela invisível da troca; volta B de 5,2 a 10,4s com `Terminó abajo` a 0,994 em 9,8s; em 10,3s as duas em 0 de novo para voltar à A.
- Quadro base (o que fica com `prefers-reduced-motion`): volta A resolvida, com a volta B em `opacity: 0` — só uma das duas aparece.
- Coreografia medida por fase, com a animação travada por CSS: 6% a escolha acende com a série intacta; 30% desenhando com o resultado escondido; 55% série pronta e o ponto entrando; 88% o quadro segurado, idêntico ao Figma. No limite do loop tudo volta a transparente e o UP a 0.4, então reinicia sem salto.
- `prefers-reduced-motion` simulado com `animation: none`: cai exatamente no quadro do Figma.
- Fechamento por X, Escape, overlay e CTA, todos devolvendo o foco ao botão e liberando o `inert`.
- Geometria responsiva varrida em 320, 360, 375, 430 e 499px de tela, depois das correções: a folga entre a pílula e a bolinha dá 7,99px em todas — o valor do Figma —, a curva mede exatamente o vão em todas, a linha verde termina sempre sob a pílula e a pílula nunca sai do card. A ponta pintada da curva cai sobre o centro da bolinha com ~1px de diferença, dentro da meia-espessura do traço.
- Fases do desenho remedidas depois das correções: 0 a 8% parada e transparente, sem nada pintado; 8,5% com 4,3px de traço a 50% de opacidade; 9% com 8,5px já opaco; 15% com 59,6px; 30% com 187px; 48% completa em 340,3px; 88% segurada; 99% desaparecida.
- A animação foi verificada rodando: com a aba fronteada, as cinco animações avançam 800ms em 800ms, `playState: "running"` e `prefers-reduced-motion` em `false`.
- Não validado: quadro intermediário por captura de tela. O `screenshot` do painel do browser vem com pintura defasada nesses elementos animados, e a troca de visibilidade do painel desfaz `pause()` via JS. A validação da coreografia foi por estilo computado, não por imagem.
- Não validado: clique real de ponteiro. O `computer` do painel dá timeout nesta sessão, então os cliques foram despachados por DOM, que passa pelo `onClick` do React.

### Pendências e próximo passo

- Os quatro cards estão implementados, mesclados e publicados. Não há próximo passo pendente de design.
- Publicação verificada em `https://design-draftea.github.io/pulse/` por marcador no código minificado, como a tarefa anterior registrou que é o método certo — comparar hash do bundle não funciona porque o workflow injeta `VITE_BASE_PATH` e `VITE_POLYMARKET_PROXY_ORIGIN`. Conferidos no JS: `onboarding-sheet`, `Cómo funciona Draftea Pulse`, `pulse.onboarding.invite.dismissed`, `Valor de venta`, `Vendido por`, `resetOnboarding`, `Puedes vender antes` e `Entendido, empezar`. No CSS: `onboarding-series-marker`, `onboarding-chart-crossing`, `sub-header-help-invite`, `onboarding-motion` e `onboarding-step-enter-forward`.
- O deploy do Pages é automático no push para `main` (`.github/workflows/deploy-pages.yml`); a execução do merge concluiu com sucesso. Os bullets já mostram o total de quatro e a navegação alcança os passos sozinha conforme a lista cresce.
- A pílula `Terminó arriba` está duplicada entre `OnboardingChart.css` e `OnboardingRoundClock.css`. Com dois usos, duplicar custou menos que mexer no card 1 já validado; se um terceiro card reusar, vale extrair numa classe compartilhada.
- Arrastar entre os cards ficou de fora de propósito: com um passo só não há como verificar. Entra junto com os cards 2 a 4. Bullets seguem como indicador, não como controle — alvo de 6px é pequeno demais.
- As durações dos cards divergiram de propósito: 5,2s no card 1, ciclo de 10,4s no card 2 (duas voltas de 5,2s) e 7,8s no card 3. Cada uma segue o que o conteúdo do card precisa; o valor fica em `--onboarding-*-duration` de cada arquivo.
- O ciclo do card 2 leva 10,4s para mostrar as duas saídas. Quem olhar por 5s vê uma delas, o que já está completo; quem ficar vê as duas. Se ficar longo demais na sua leitura, o corte natural é encurtar a pausa do quadro final de cada volta, de ~1,3s para ~0,9s, o que levaria o ciclo para 9,6s.
- O brilho roxo do topo do sheet merece o olho da pessoa usuária contra o Figma real. O valor é o do design, mas no navegador ele lê um pouco mais forte que no render do Figma.
- A pílula `Terminó arriba` e o rótulo `PRECIO OBJETIVO` têm largura de texto, então não acompanham a largura da tela como o resto do card. Isso está resolvido para a linha verde, que agora se ancora na pílula, mas vale conferir o conjunto se algum card novo colocar mais coisas nessa faixa.
- Renomear `iconOnboading.svg` para `iconOnboarding.svg` depende de autorização, por ser arquivo da pessoa usuária.
- Sem commit, PR, merge ou publicação. Nada foi autorizado.


## Histórico: medição do rótulo de preço (PRs #50 e #51)


- Atualizado em: 2026-09-03
- Agente que entrega: Claude
- Agente esperado a seguir: nenhum
- Status: concluído — mesclado pelo PR #50 e publicado no GitHub Pages, com a publicação verificada no artefato real. A pessoa usuária autorizou explicitamente push, merge e publicação depois da entrega técnica
- Objetivo: corrigir a medição frágil de `priceLabelWidth` no `PriceChart`, irmã do defeito que o PR #49 corrigiu na etiqueta do preço objetivo. Ela estava registrada como pendência conhecida e fora do escopo daquele PR
- Escopo acordado: apenas essa medição. A geometria, a escala, o arrasto, o desenho da série, a camada do objetivo e o CSS permanecem intocados
- Critérios de aceite: com a série chegando depois do primeiro quadro, `--price-chart-value-right` é publicada e a borda direita da pílula `LIVE` alinha com a dos rótulos de preço
- Branch: `fix/medicao-rotulo-preco`, criada a partir da `main` em `cd5bdca`, commits `233cba2`, `020c2e0` e `b3c377c`, PR #50, mesclada em `2b04ee3` e removida do remoto

### O defeito

- O `useLayoutEffect` lia o nó por `useRef` e dependia de `[priceLabelSample.length, chartWidth]`. Na primeira renderização a série está vazia, o componente sai pelo retorno antecipado do `Esperando datos del mercado` e o `<text>` da grade não existe, então a medição encontrava `null` e desistia.
- O `containerRef` está preso nessa `div` do estado vazio, então `chartWidth` já é medido ali e não muda quando a série chega. Se o comprimento de `priceLabelSample` também não mudar, nenhuma das duas dependências muda depois de o nó entrar no DOM, o efeito nunca roda de novo e `priceLabelWidth` fica em `0`.
- Consequência: `--price-chart-value-right` não é publicada e a pílula `LIVE` cai no retorno `right: 24px` do CSS. Afeta só o alinhamento horizontal dessa pílula, que aparece durante o arrasto.

### A correção

- O nó passou a ser guardado em `useState`, com `ref={index === 0 ? setPriceLabelNode : undefined}` no `<text>`, e entrou nas dependências do efeito. Mesmo padrão da etiqueta do objetivo e de `usePriceChartWidth`.
- Sobre o `ref` condicional: a função passada é o próprio setter de `useState`, cuja identidade o React garante estável, então ela não é reinvocada a cada quadro — e o componente re-renderiza por `requestAnimationFrame`, então uma função inline ali causaria `null` e reanexação em todo quadro. As chaves da grade são por índice e `GRID_LINE_COUNT` é a constante `7`, de modo que o `<text>` do índice `0` nunca troca de posição nem remonta ao mudar os valores; o `null` só chega quando o componente inteiro sai pelo retorno antecipado, e aí a remontagem remede.
- Decisão de forma: a medição ficou dentro de uma função nomeada `measure`, como nas duas medições irmãs do arquivo. Com o `setPriceLabelWidth` direto no corpo do efeito, o `react(set-state-in-effect)` do oxlint passou a acusar cascata de renderização, porque o efeito agora depende de estado próprio. A regra só enxerga chamadas diretas no corpo, e é por isso que a medição do objetivo e a de `usePriceChartWidth`, que fazem exatamente o mesmo, nunca avisaram. O aviso é falso-positivo — medir o DOM depois da pintura é o caso de uso de um efeito de layout, e a cascata é finita e converge pelo limiar de `0,5px` —, mas a alternativa era deixar o primeiro aviso de lint do repositório ou introduzir a primeira diretiva de `oxlint-disable`. O motivo está em comentário no código.

### Validações

- `pnpm lint` limpo, `pnpm build` sem erros e a suíte completa passando: `test:chart` 26, `test:market` 25, `test:wallet` 19, `test:entries` 8, `test:fallback` 6, `test:proxy` 6, `test:assets` 3.
- Sem teste de regressão, pelo mesmo motivo registrado no PR #49: o defeito vive num efeito de layout que depende de `getBBox`, e a suíte roda em `node --test` sem DOM.
- Validado no navegador com um harness temporário, já removido, que renderiza o `PriceChart` com `points: []` e alimenta a série 400ms depois, com `viewAnchorTimestamp` diferente de `null` para a pílula `LIVE` existir.
- Defeito reproduzido antes de corrigir, com o arquivo da `main` no mesmo harness: `--price-chart-value-right` ausente, `right` computado em `24px` e a borda direita da pílula 17,7px à esquerda da dos rótulos, com o domínio em `$1,180,600.00`.
- Com a correção, no mesmo caso: variável publicada em `6,3125px` e as bordas direitas coincidindo exatamente — as sete linhas da grade e a pílula todas em `821,188px`.
- O domínio largo foi escolhido de propósito. Com `$80,600.00` a medição dá `23,72px`, quase igual ao retorno de `24px` do CSS, e o desalinhamento do defeito seria de 0,28px — invisível e insuficiente como prova.
- Conferido também o caminho de remontagem: ao voltar ao estado vazio o `<text>` sai do DOM e a função de `ref` recebe `null`; ao religar a série a medição volta e a variável é republicada com o mesmo valor. Nenhum erro de profundidade de atualização no console, o que descarta laço de renderização pela troca de `ref`.
- Conferida a remedição por comprimento: encurtando o rótulo de `$1,180,600.00` para `$80,600.00`, a variável passou de `6,3125px` para `23,71875px` e o alinhamento continuou exato.
- Não validado com dados reais de mercado: o ambiente do agente não tem saída de rede e os feeds são WebSocket abertos pelo navegador.

### Pendências e próximo passo

- Publicação verificada em `https://design-draftea.github.io/pulse/`, baixando o bundle e conferindo o código minificado: o nó em `useState`, o `ref` condicional do `<text>` recebendo a função de estado, o nó na lista de dependências do efeito e a publicação da variável CSS condicionada à largura medida.
- Detalhe para as próximas verificações: comparar o hash do bundle local com o publicado não funciona aqui. O workflow injeta `VITE_BASE_PATH` e `VITE_POLYMARKET_PROXY_ORIGIN`, então o conteúdo difere legitimamente. A conferência tem de ser por marcador no código minificado.
- Ao mesclar, o `gh pr merge --delete-branch` falhou na etapa local, com `'main' is already used by worktree`, porque a sessão rodava em um worktree e a `main` está no checkout principal. O merge no GitHub foi concluído mesmo assim; só a remoção da branch remota ficou para trás e foi feita depois com `git push origin --delete`. Vale registrar o padrão: em worktree, conferir o estado do PR antes de concluir que o comando falhou.
- Pendência pré-existente, mantida fora do escopo: essa mesma medição tem a corrida de fonte que o PR #49 resolveu na etiqueta do objetivo. A Red Hat Display vem do Google Fonts com `display=swap`, então a primeira medição acontece na fonte de retorno e a largura fica um pouco errada até a página recarregar. A etiqueta do objetivo remede em `document.fonts.ready`; esta não. O efeito é um desalinhamento pequeno da pílula `LIVE`, e a função `measure` já está no lugar certo para receber o mesmo tratamento.
- Continua sem observação em movimento a transição de travamento da linha do objetivo, registrada na tarefa anterior. Nada nesta mudança mexe nisso.

## Histórico: linha do preço objetivo (PRs #48 e #49)

### Estado no encerramento

- Atualizado em: 2026-09-03
- Agente que entrega: Claude
- Agente esperado a seguir: nenhum
- Status: concluído — mesclado pelos PRs #48 e #49 e publicado no GitHub Pages, com a publicação verificada no artefato real. O PR #48 subiu com um defeito, encontrado pela pessoa usuária em produção, e o PR #49 é a correção. Todas as autorizações vieram dela
- Objetivo: acrescentar a linha do preço objetivo ao gráfico, com três estados — dentro da faixa de preços, travada acima e travada abaixo — a partir do nó `17:13176` do Figma
- Escopo acordado: apenas a camada da linha do objetivo. A geometria do gráfico, o domínio, a escala, o arrasto, o desenho da série, o indicador de direção e a pílula do preço atual permanecem como estavam
- Critérios de aceite: objetivo dentro do domínio desenha a linha a 50% sem seta; fora dele, a linha trava na borda da faixa, em opacidade cheia, com a seta parada apontando para fora
- Branches: `feature/linha-preco-objetivo`, commits `f3c7a7b` e `c0687d9`, PR #48, mesclada em `683d1dd` e removida do remoto. Depois `fix/linha-objetivo-sem-preco`, PR #49, com a correção
- Decisão de nome da branch: já existia uma `feature/linha-objetivo-grafico` local, sem commits além da `main` e sem trabalho dentro. Foi preservada em vez de removida, porque apagar branch da pessoa usuária exige autorização, e a tarefa ganhou um nome novo

### Leitura do Figma

- O MCP remoto do Figma respondeu sem autorização nesta sessão. O design foi lido pelo servidor local do Figma Desktop em `127.0.0.1:3845`, que usa a sessão da pessoa usuária, falando JSON-RPC direto por HTTP. Vale registrar que esse caminho continua funcionando, como já tinha acontecido no PR #41
- Os três estados existem como frames separados: `536:13573` dentro do gráfico, `536:13552` travado acima e `535:13547` travado abaixo
- A linha é sólida de 1px, em `Fill Colors/fillTertiary` dentro da faixa e `fillPrimary` travada. Os dois assets exportados diferem só pelo `stroke-opacity` de 50%
- A pílula usa `Background/backgroundApp`, altura de 16px, raio total, `padding` de `8/8` sem seta e `8/4` com `gap` de 2 quando tem seta, e a borda esquerda fixa em `x = 66`
- O texto é `$80,195.64 - objetivo`, com hífen simples (`0x2D`, conferido no byte) e minúsculo, em 10px peso 500 e `lnum`/`tnum`, que o gráfico já herda

### Alterações realizadas

- `src/components/priceChartModel.ts`: `projectPriceToY` extraída como definição única da conversão de preço em `y`, e `resolvePriceChartTarget` nova, devolvendo `{ y, clamp }` ou `null`.
- `src/components/PriceChart.tsx`: prop `targetPrice`, a camada da linha do objetivo, constantes nomeadas no lugar de `y` repetidos, e a reordenação do eixo temporal.
- `src/components/PriceChart.css`: os estilos da linha, da pílula e dos chevrons do objetivo. Só adições.
- `src/components/MarketPriceChart/MarketPriceChart.tsx`: repasse do `targetPrice` que ele já recebia e usava apenas como reserva do domínio.
- `tests/priceChartModel.test.ts`: sete testes novos, cobrindo os três estados, as bordas do domínio, a separação entre domínio estabilizado e interpolado, a coincidência de `y` entre travado e borda, e as entradas degeneradas.
- `src/components/priceChartGeometry.ts` e `src/components/priceChartLayout.ts` foram alterados e depois revertidos por completo; hoje estão idênticos à `main`.

### O caminho até travar na borda da faixa, e por que ele voltou atrás

- O nó do Figma tem 293px de altura e reserva 25px de respiro entre a faixa da grade e a linha travada. O gráfico implementado tem 256px e não reservava nenhum: a última linha da grade e o início do eixo temporal eram o mesmo `y = 220`.
- A escolha foi levada à pessoa usuária com três opções. Ela decidiu reproduzir os 25px do Figma, crescendo o gráfico. Isso foi implementado: `PLOT_TOP` para `33`, `PLOT_BOTTOM` para `237`, altura para `293`, eixo temporal 42px abaixo e feed de entradas deslocado em `+17`.
- Vendo o resultado, ela apontou que sem nada travado embaixo sobrava um vão considerável e que o eixo temporal ficava estranho. Estava certa, e as duas queixas eram o mesmo defeito: no Figma a linha travada embaixo e o início do eixo temporal são o mesmo `y = 262`, e eu tratei isso como estrutura, amarrando um ao outro no código. Para dar respiro à linha travada, o eixo desceu junto e perdeu a emenda com a grade — e é essa emenda que faz o eixo ler como eixo.
- Não existe valor intermediário. A pílula tem 16px, então com respiro menor que 13px ela cobre os tracinhos do eixo, e com respiro maior a linha passa por baixo deles, que é pior. Ou o respiro é zero, ou o eixo desce os 25px.
- Decisão final, autorizada por ela: respiro zero. A linha trava na própria borda da faixa, `TIME_AXIS_TICK_TOP` voltou a ser `PLOT_BOTTOM` e toda a geometria vertical voltou ao que era. `priceChartGeometry.ts` e `priceChartLayout.ts` saíram do diff, e a Home não desce mais 37px.
- Efeito colateral que reforça a decisão: com respiro zero, um objetivo exatamente no topo do domínio e um objetivo travado acima caem no mesmo `y`. O que os distingue passa a ser a opacidade da linha e a presença da seta. Aquela diferença de opacidade entre os dois assets do Figma, que parecia decoração, é o que carrega a informação. Há um teste garantindo essa coincidência de `y`.

### Decisões da linha do objetivo

- Extensão da linha: o nó do Figma desenha 343px, de `x = 16` a `x = 359`, passando por cima da coluna dos rótulos de preço. Naquele frame a linha travada nunca cai sobre uma linha da grade, então a colisão não aparece; travada na borda da faixa, ela risca o rótulo mais externo, e isso foi visto no navegador. A linha passou a parar em `plotRight`, como a grade e a linha tracejada do preço atual, que já respeitam essa coluna. As três linhas de nível do gráfico agora têm a mesma extensão, `16` a `280`.
- O veredito de travamento vem do domínio já estabilizado e a posição vem do domínio interpolado. Decidir os dois pelo interpolado faria a seta e a largura da pílula piscarem durante os 280ms de animação sempre que o objetivo estivesse parado exatamente na borda. Com isso não há transição a animar: o estado troca de uma vez, e é estável.
- A pílula é opaca, então oclui a linha, a grade e a série atrás dela. Isso dispensou o vão na linha e a máscara que o plano inicial previa, e é o que resolve a legibilidade quando a linha branca do preço passa por trás do texto.
- A largura da pílula vem da medição real do texto por `getBBox()`, no mesmo padrão que o componente já usava para o rótulo de preço, e não de um valor fixo. O nó do Figma tem 129px para o estado travado, mas isso depende das métricas da fonte; derivar da medição mantém o `padding` correto qualquer que seja o texto.
- Bug encontrado durante a validação: a Red Hat Display vem do Google Fonts com `display=swap`, então a primeira medição acontece na fonte de retorno e a fonte real chega depois. Sem remedir, a pílula ficaria dimensionada para a fonte errada. A medição passou a repetir em `document.fonts.ready`.
- Observação, fora do escopo: a medição pré-existente de `priceLabelWidth` tem a mesma corrida de fonte. Ela alimenta só o alinhamento horizontal da pílula `LIVE`, então o efeito é bem menor, e não foi alterada para manter a mudança restrita ao pedido.
- Os chevrons não reaproveitam o `DirectionChevrons` do indicador de direção: aquele é o glifo de 24px com traço de 1.5, os dois chevrons iguais e animados; o do objetivo é a variante de 16px com traço de 1, o da frente cheio, o de trás a 50% e parado. São variantes distintas do mesmo ícone, então o indicador de direção não foi tocado.
- Decisão sobre o asset dos chevrons: em vez de commitar o SVG exportado e referenciá-lo, os dois `d` exatos do export foram desenhados inline. O gráfico é um `<svg>` inline que já desenha esse mesmo glifo como `path`, e um `<image>` no meio dele seria inconsistente com o arquivo. O desenho é idêntico, porque os dados vetoriais vieram do próprio export.
- O estado travado abaixo espelha o ícone com `scaleY(-1)` em `transform-box: fill-box`, como o `-scale-y-100` do nó `535:13548`. Os dois chevrons são simétricos em torno do centro da própria caixa, então o espelho troca exatamente o cheio pelo de 50% e o glifo aponta para baixo.
- O eixo temporal passou a ser desenhado antes da linha do objetivo. A pílula travada embaixo pousa sobre os tracinhos de 5px do eixo, e com a ordem anterior eles atravessavam o texto. No Figma os nós `preco-objetivo-*` estão acima de `tempo`, então ocultá-los é o comportamento do desenho. A troca de ordem também põe o grupo do preço atual acima do eixo; na prática nada muda, porque os dois só se aproximam quando o preço encosta na base do domínio, e ali o que se sobrepõe é o halo do ponto, com 8% de opacidade.
- Ordem entre o objetivo e o preço atual, corrigida a pedido da pessoa usuária: o tracejado do preço atual foi separado em `price-chart__current-line-level`, desenhado antes da linha do objetivo, enquanto o ponto, os chevrons de direção e a pílula do preço atual seguem depois, em `price-chart__current-level`. Quando os dois níveis coincidem, o tracejado atravessava a pílula opaca e o rótulo do objetivo. Registro de rigor: a ordem não altera a cor onde as duas linhas se cruzam, porque a composição alpha dá o mesmo resultado nos dois sentidos; o que mudou de fato é a oclusão da pílula e do texto.
- Isso só passou a ser possível depois de a linha parar em `plotRight`. A objeção anterior era que a linha do objetivo atravessaria a pílula roxa do preço atual; com a linha terminando em `plotRight`, que é exatamente onde a pílula começa, as duas apenas se tocam. O ponto branco e a pílula roxa continuam acima da linha do objetivo.
- A camada do objetivo fica, no restante, abaixo do grupo do preço atual, e não acima como no Figma. No arquivo os dois nunca se cruzam verticalmente, então o desenho não decide isso; na prática o objetivo é o preço de abertura da rodada e o preço atual orbita em volta dele, de modo que os dois se cruzam com frequência. Com a ordem do Figma, a linha do objetivo atravessaria a pílula roxa do preço atual. As duas pílulas ficam em `x = 66` e `x = 282`, então nunca se sobrepõem.
- Sem preço objetivo definido, nada é desenhado. Nos primeiros segundos da rodada o alvo pode ser nulo, e nesse intervalo a linha simplesmente não existe, em vez de segurar o alvo da rodada anterior.
- Acessibilidade: o grupo é `aria-hidden`, porque o valor já é anunciado pelo card `Precio objetivo`. `data-target-price`, `data-target-clamp` e `data-target-y` foram acrescentados ao `figure`, seguindo os atributos de validação que já existiam ali.

### Validações

- `pnpm lint` e `pnpm build` limpos.
- `pnpm test:chart` com 26 testes passando, sendo sete novos.
- Ordem de pintura conferida no DOM: `grid`, série, `time-axis`, `current-line-level`, `target`, `current-level`, `entry-feed`, com o tracejado e o objetivo no mesmo `y` no caso em que o objetivo coincide com o preço atual.
- Validação no navegador: o ambiente do agente não tem saída de rede, e os três feeds de preço são WebSocket abertos direto pelo navegador, então o gráfico não desenha ali com dados reais. Os estados foram validados em uma página temporária com série sintética, já removida, que também cobriu o caso do objetivo coincidindo com o preço atual.
- Medido no DOM depois da reversão: figura de 256px, `viewBox` de `375x256`, grade em `16, 50, 84, 118, 152, 186, 220`, recorte em `y = 5` com altura `216`, tracinho do eixo de `220` a `225` e rótulo de horário em `246` — todos idênticos à `main`. Grade, linha do preço atual e linha do objetivo com a mesma extensão, de `16` a `280`.
- Medido nos três estados: travamento em `y = 16` acima e `y = 220` abaixo, linha e texto a 50% dentro da faixa e em opacidade cheia travados, chevron com traço de 1px, `animation: none`, e `matrix(1, 0, 0, -1, 0, 0)` no estado de baixo.
- A largura da pílula bate com `padding` mais texto medido em todos os rótulos testados, incluindo um de 24 caracteres.

### Pendências e próximo passo

- Não validado: o comportamento com dados reais de mercado, por falta de rede no ambiente do agente. Em especial a troca de estado quando o preço se afasta do objetivo até tirá-lo do domínio.
- O `gh pr merge` foi barrado pelo classificador de permissões do agente nas duas primeiras tentativas, com e sem `--delete-branch`, como já tinha acontecido no PR #45. Não foi contornado. Passou depois que a pessoa usuária autorizou explicitamente o agente a operar o Git. Vale registrar o padrão para as próximas tarefas.
- Deploy: o workflow `deploy-pages.yml` dispara em `push` para a `main`, então o merge publica sozinho. Não há passo manual.
- Publicação do PR #48 verificada em `https://design-draftea.github.io/pulse/`, baixando os assets e conferindo marcadores no JS e no CSS, incluindo a ausência de `293px`, o que confirmou que a reversão da geometria entrou.

### Defeito do PR #48: linha sem o preço, e a correção do PR #49

- Sintoma, notado pela pessoa usuária em produção: a linha do objetivo aparecia, mas sem a pílula e sem o texto. Só o traço.
- Causa: o `useLayoutEffect` que mede o texto dependia apenas de `targetLabel?.length` e lia o nó por `useRef`. Na primeira renderização a série está vazia, o componente sai pelo retorno antecipado do `Esperando datos del mercado` e o `<text>` não existe, então a medição encontrava `null` e desistia. Quando os pontos chegavam e o `<text>` entrava no DOM, o comprimento do rótulo não havia mudado, porque o objetivo é travado na rodada, então o efeito nunca rodava de novo. A largura ficava zero e o grupo da etiqueta renderizava com `opacity: 0`.
- Correção: o nó passou a ser guardado em estado, com `ref={setTargetLabelNode}`, e entrou na lista de dependências. É o mesmo padrão que `usePriceChartWidth` já usa no arquivo. Assim a medição reage à entrada do nó no DOM.
- Por que a validação original não pegou: o harness passava a série já preenchida desde o primeiro quadro, então o `<text>` existia de imediato e a primeira medição funcionava. O caminho real, em que o objetivo existe antes da série, nunca foi exercitado. A lição prática é que qualquer harness deste componente precisa começar com `points: []` e só depois alimentar a série.
- O defeito foi reproduzido localmente antes da correção, com um harness que atrasa a série em 400ms, e a correção foi confirmada no mesmo harness: `opacity` de `0` para `1` e pílula de `0` para `8 + texto + 8`.
- Sem teste de regressão: o defeito vive num efeito de layout que depende de `getBBox`, e a suíte roda em `node --test` sem DOM. `renderToString` não executa efeitos nem mede texto, então cobrir isso exigiria trazer jsdom, uma dependência nova. Ficou registrado em comentário no código, junto do motivo.

### Pendências

- Defeito irmão, pré-existente e fora do escopo: a medição de `priceLabelWidth`, no mesmo arquivo, tem a mesma fragilidade. Ela depende de `[priceLabelSample.length, chartWidth]`, e o contêiner é medido já no estado vazio, então se o comprimento do rótulo de preço não mudar entre o estado vazio e a série cheia, a largura fica zero e a pílula `LIVE` cai no retorno `right: 24px` em vez do alinhamento medido. Afeta só o alinhamento horizontal da pílula `LIVE` durante o arrasto. Não foi alterada para manter a correção restrita ao defeito relatado. Corrigida depois, na branch `fix/medicao-rotulo-preco`, registrada no `Estado atual`.
- A troca de estado nunca foi observada em movimento. O harness usou série e objetivo fixos, então validou os desenhos parados e a geometria, e nada que dependa do tempo. Como o veredito de travamento vem do domínio estabilizado e a posição vem do interpolado, no instante em que o objetivo sai do domínio a linha salta para a borda e a pílula cresce cerca de 22px de uma vez, enquanto os rótulos da grade ainda animam os `280ms`. Pode ler como encaixe ou como tranco; não se sabe. A lógica tem teste unitário fixando o comportamento, o visual da transição não.
- Registro de rigor: a falta de rede no ambiente do agente impediu a validação com dados reais de mercado, mas não impedia simular movimento animando a série. Não observar a transição foi lacuna de verificação, não limitação do ambiente.
- A branch `docs/registrar-linha-objetivo` foi criada nesta sessão e empurrada com um commit de handoff que este PR substitui. Ela não foi mesclada e pode ser removida.

## Histórico: Centro de ayuda e navegação do bottom sheet (PRs #45 e #46)

### Estado no encerramento

- Atualizado em: 2026-09-03
- Agente que entrega: Claude
- Agente esperado a seguir: nenhum
- Status: concluído — implementado, validado localmente, mesclado na `main` pelo PR #45 e publicado no GitHub Pages, com a publicação verificada. O commit, o push, o PR, o merge e o deploy foram autorizados pela pessoa usuária
- Objetivo: alinhar o Centro de ayuda ao Figma em duas frentes — os três atalhos seguem o nó `457:8806` e o glossário segue o nó `467:10540` — e trocar a navegação do bottom sheet pela do `draftaco-v0`, em que as telas deslizam na horizontal
- Escopo acordado: o bloco `Esencial en Draftea`, a tela de glossário, a navegação entre as telas do bottom sheet e a entrada pelo rodapé da Home. O conteúdo das `Preguntas frecuentes` e o restante do sheet não foram tocados
- Critérios de aceite: três cards lado a lado, cada um com o brilho colorido no topo, o ícone de `32px` e o rótulo centrado; no glossário, cada termo precedido por um traço horizontal de `16px`, sem título repetido dentro do conteúdo; e a troca de tela deslizando, com título em fade cruzado e seta de voltar aparecendo por fade, igual ao `draftaco-v0`
- Branch: `feature/ajuda-hf`, que já continha trabalho não commitado da pessoa usuária nos mesmos arquivos. Commit `2ef501f`, mesclada em `1e41dc6`. A branch continua no remoto, porque a remoção ia junto do comando de merge que foi barrado e o merge acabou sendo feito sem ela
- Fora do escopo, mesclado em seguida: `src/components/Movements/MovementDetailModal.css` estava alterado no diretório de trabalho desde o começo, sem relação com o Centro de ayuda. Ficou de fora do PR #45 pela regra do `AGENTS.md` sobre mudanças não commitadas de terceiros, e depois, a pedido da pessoa usuária, foi para a branch `fix/movement-modal-sem-repique`, commit `5c18292`, PR #46, mesclado em `b7171d9`. O quadro de 80% da entrada do modal passava do repouso, com `translate3d(0, -2px, 0)` e `scale(1.006)`, e agora assenta em `translate3d(0, 0, 0)` e `scale(1)`

### Alterações realizadas

- `src/components/ProfileBottomSheet/ProfileBottomSheet.tsx`: `helpQuickActionItems` ganhou o campo `glow` com o token de cada brilho. O bloco passou a ser envolvido por `profile-sheet__help-essentials`, com o título `Esencial en Draftea`, e cada botão recebeu o `span` do brilho e a variável inline `--help-action-glow`.
- `src/components/ProfileBottomSheet/ProfileBottomSheet.css`: a lista vertical de `55px` deu lugar à linha de três cards, com `gap` de `8px`, borda de `1px`, raio de `16px`, `padding` de `12px`, `gap` interno de `16px`, ícone de `32px` e rótulo de `42px` em `14/16`.
- `src/styles/tokens/colors.css`: três tokens novos, todos já existentes em `mode-1.tokens.json` e apenas ausentes do subconjunto em uso — `--color-fill-opacity-quinary`, `--color-fill-warning` e `--color-component-level-content`.
- Decisão sobre o brilho: no Figma cada card traz uma `Ellipse 1` exportada como SVG, um círculo de `50px` com desfoque gaussiano de `44px`. Em vez de commitar três SVGs quase idênticos, o efeito foi reproduzido em CSS por um `span` circular de `50px` com `filter: blur(44px)`, recortado pelo `overflow: clip` do card. O `stdDeviation` do SVG e o raio do `blur()` do CSS são a mesma grandeza, então o resultado é o mesmo desenho, e a cor passa a vir de token em vez de ficar embutida no asset.
- Decisão sobre os ícones: `iconFalar.svg`, `iconPlay.svg` e `iconGlossario.svg`, que a pessoa usuária já tinha posto em `src/assets`, são os mesmos glifos do Figma, só que normalizados para uma `viewBox` de `32x32`. Foram reaproveitados como estão, sem reexportar.
- Divergência mantida de propósito: no nó do Figma o primeiro card usa `fillOpacityQuinary` na borda e os outros dois usam `fillOpacityQuaternary`. A diferença foi reproduzida como está, com comentário no CSS. Parece deslize do arquivo de design, e não intenção; vale confirmar com quem desenhou.

#### Glossário (nó `467:10540`)

- `src/components/ProfileBottomSheet/ProfileBottomSheet.tsx`: o `h3` interno com o texto `Glosario` saiu, porque o cabeçalho do sheet já mostra esse título e o nó do Figma não o repete no conteúdo. Com ele fora, os termos subiram de `h4` para `h3`, logo abaixo do `h2` do cabeçalho, sem pular nível. O `div` intermediário `profile-sheet__help-glossary-list` também saiu, já que a própria seção passou a ser a lista.
- `src/components/ProfileBottomSheet/ProfileBottomSheet.css`: o traço deixou de ser vertical e passou a ser o traço horizontal de `16px` do nó `467:12039`. A coluna do traço estica na altura da caixa e tem `12px` de respiro vertical, que é o que alinha o traço ao centro da primeira linha do termo. A separação entre termos deixou de ser `padding` de `12px` e virou `gap` de `24px`, e o `margin-bottom` de `4px` do termo saiu em favor do `gap` de `2px` do Figma.
- Decisão sobre a cor do traço: o SVG exportado traz `stroke="#FBFBFB"` sem opacidade, e a amostragem do render do Figma confirmou, então o traço usa `--color-fill-primary`. Antes usava `--color-fill-secondary`.
- Os doze termos e as doze definições já batiam com o Figma palavra por palavra. Nenhum texto foi alterado.
- O `profile-sheet__help-spacer` foi mantido. Ele tem altura zero e só contribui um `gap`, e é a única folga que sobra abaixo do último termo, já que o sheet não trata `safe-area-inset-bottom`. O nó do Figma termina no último bloco, então isso é uma diferença consciente, a favor do aparelho real.

#### Navegação do bottom sheet, portada do `draftaco-v0`

- Referência: `draftaco-v0/src/components/ProfileBottomSheet/ProfileBottomSheet.tsx` e o CSS ao lado, no caminho em que o perfil abre depósito ou saque. O repositório já estava clonado em `~/Desktop/PITACO/draftaco-v0`. Nada foi copiado de lá para cá; o padrão foi lido e reescrito com os nomes do Pulse.
- Antes as quatro telas trocavam por um ternário dentro de um único `profile-sheet__content`, sem transição. Agora existe um `profile-sheet__stage` com as quatro rotas montadas ao mesmo tempo, `position: absolute` sobre o palco, deslizando por `transform` e `opacity` em `300ms ease-out`.
- Cada rota tem uma profundidade em `routeDepthByMode`: `profile` é `0`, `help` é `1`, e `help-question` e `help-glossary` são `2`. Quem está mais raso que a rota ativa descansa em `-100%`, quem está mais fundo descansa em `100%`. É isso que faz avançar empurrar para a esquerda e voltar empurrar para a direita, sem precisar guardar o sentido do movimento.
- Os três títulos passaram a ficar empilhados na coluna do meio do header, por `grid-template-areas`, e trocam por fade cruzado de `150ms` com `150ms` de atraso na entrada. `help-question` reaproveita o título de `help`, então entrar numa pergunta não pisca o título.
- A seta de voltar deixou de ser montada e desmontada. Agora está sempre no DOM e aparece pelo mesmo fade, com `aria-hidden`, `tabIndex` e `disabled` acompanhando.
- `goToMode` centralizou as trocas, com a trava `isRouteTransitioning` durante os `300ms`, igual ao `isRouteTransitioning` do draftaco. A pergunta aberta só é esquecida no fim do temporizador, senão a tela esvaziaria no meio do trajeto.
- `aria-labelledby="profile-sheet-title"` deu lugar a `aria-label={sheetTitle}` no diálogo, porque agora há três `h2` no header e o `id` único deixaria de fazer sentido. É o mesmo que o draftaco faz.
- Cada rota passou a ter o próprio contêiner de rolagem, e `goToMode` zera a rolagem da rota de destino antes de ela entrar. Como o destino ainda está fora da tela nesse instante, o salto não é visível e a tela entra sempre mostrando o começo do conteúdo. A pendência da tarefa anterior, em que voltar do glossário devolvia o Centro de ayuda rolado no meio, está encerrada.
- Decisão de escopo: a pessoa usuária pediu isso para o botão de voltar. O mesmo vale para a ida, porque abrir o glossário e cair no meio da lista seria o mesmo defeito na direção oposta. Se um dia só a volta precisar zerar, a condição é uma linha em `goToMode`.

#### Entrada pelo rodapé da Home

- `src/components/PulseFooter/PulseFooter.tsx`: `FOOTER_LINKS` deixou de ser uma lista de textos e passou a ter `id` e `label`, para que só a entrada `faq` receba ação. O componente ganhou a prop opcional `onHelpOpen`. `Términos y condiciones`, `Aviso de privacidad` e `Soporte` continuam sem ação, como antes.
- `src/components/ProfileBottomSheet/ProfileBottomSheet.tsx`: nova prop opcional `initialMode`, com `profile` como padrão. O efeito de abertura passou a usá-la no lugar do `profile` fixo. O tipo `ProfileBottomSheetMode` passou a ser exportado, pelo arquivo e pelo `index.ts`.
- `src/App.tsx`: novo estado `profileSheetMode` e novo `handleHelpOpen`. O avatar do header continua abrindo em `profile`; o rodapé abre em `help`.
- Decisão, corrigida a pedido da pessoa usuária: a raiz da pilha é a tela em que o sheet abriu, e não o perfil. O estado `rootMode` guarda o `initialMode` no momento da abertura, e `canGoBack` compara a profundidade da rota ativa com a da raiz. Aberto pelo rodapé, o Centro de ayuda é a raiz e o header não mostra a seta; entrar no glossário a partir dali faz a seta aparecer, e voltar para a ajuda a esconde de novo. Aberto pelo avatar, o perfil é a raiz e a mesma tela de ajuda passa a ter seta. Antes a seta aparecia sempre que o modo fosse de ajuda, o que dava um caminho de volta para um perfil de onde a pessoa nunca tinha vindo.

- Foi acrescentado um bloco `prefers-reduced-motion` desligando as três transições.



## Histórico: cor das setas do gráfico (PR #43)

### Estado no encerramento

- Atualizado em: 2026-09-02
- Agente que entrega: Claude
- Agente esperado a seguir: nenhum
- Status: concluído — implementado, validado localmente, mesclado na `main` pelo PR #43 e publicado no GitHub Pages, com a publicação verificada no ambiente real. O commit, o push, o PR, o merge e o deploy foram autorizados pela pessoa usuária
- Objetivo: as setas de direção do gráfico passam a seguir a direção do preço, verdes na alta e vermelhas na queda
- Escopo acordado: apenas a cor dos chevrons de direção do `PriceChart`. Animação, tamanho, posicionamento e a lógica que decide a direção permanecem como estavam
- Critérios de aceite: subida em verde, queda em vermelho, sem cor nova fora dos tokens existentes
- Branch: `feature/setas-grafico-cor-direcao`, criada a partir da `main` em `3f8d386`, no checkout principal. Commit `ce6128a`, mesclada em `3afaa51` e removida do remoto

### Alterações realizadas

- `src/components/PriceChart.css`: duas regras novas, `.price-chart__direction-state--up .price-chart__direction-chevron` com `var(--color-fill-success)` e `.price-chart__direction-state--down .price-chart__direction-chevron` com `var(--color-fill-error)`. O diff inteiro tem 8 linhas.
- Decisão sobre a cor: foram reaproveitados os tokens de `src/styles/tokens/colors.css` que UP e DOWN já usam, `#34d399` e `#f87171`, em vez de criar um par novo. Assim a seta e o lado do mercado que ela sugere falam a mesma língua visual.
- Decisão sobre onde aplicar: a cor foi posta no seletor descendente de cada estado, e não no `.price-chart__direction-chevron` base. A declaração base com `rgba(251, 251, 251, 0.5)` continua como retorno seguro caso algum dia um chevron seja desenhado fora dos dois estados.
- Nada foi mudado em `src/components/PriceChart.tsx`: os dois estados `--up` e `--down` já existiam no DOM e a direção já era decidida em `src/services/marketPriceDirection.ts`, por janela de `1,5s`, delta mínimo de `0,01` e duas confirmações. A mudança é puramente de apresentação.
- Origem dos dados, conferida durante a tarefa a pedido da pessoa usuária: a linha do gráfico vem de Chainlink, Coinbase ou Kraken, escolhida por rodada em `useBtcPriceFeeds.ts`; a Polymarket aparece ali apenas como relay do RTDS da Chainlink. Os percentuais UP/DOWN é que são da Polymarket, pela Gamma e pelo CLOB. As setas não vêm de fonte nenhuma, são derivadas localmente do preço já exibido.

## Histórico: resumo de entradas abertas na Home (PR #41)

### Estado no encerramento

- Atualizado em: 2026-09-02
- Agente que entrega: Claude
- Agente esperado a seguir: nenhum
- Status: concluído. Implementado, validado localmente, mesclado na `main` pelo PR #41 e publicado no GitHub Pages
- Objetivo: implementar o nó `497:12722` do Figma como resumo das entradas abertas na Home, logo abaixo do gráfico
- Escopo acordado: a seção aparece na Home entre `MarketPriceChart` e `PreviousRounds` e empurra o restante para baixo; no máximo duas entradas por rodada, uma em UP e outra em DOWN, pela mesma regra já usada na aba `Entradas`; a entrada nova é revelada com a mesma microinteração de uma ronda que chega em `PreviousRounds`
- Ajuste pedido depois do primeiro teste, já implementado: a entrada só aparece depois do toaster de sucesso; antes disso a página centraliza a seção na janela; o título entra com fade quando a seção passa a existir e sai com fade na venda
- Ajuste pedido depois do segundo teste, já implementado: com uma entrada aberta só, o card ocupa a largura inteira
- Defeito relatado no terceiro teste e corrigido: ao comprar DOWN o card entrava imediatamente. Não era do lado DOWN, e sim de repetir o mesmo lado na mesma rodada, que reaproveitava a deixa da revelação anterior
- Ajuste pedido depois do quarto teste, já implementado: na venda o card sai só com fade, parado, e com duas entradas a que fica ocupa a posição da que saiu
- Critérios de aceite: layout fiel ao nó, seção ausente sem posição aberta, `Vender` abrindo o betslip em modo de venda no lado correto, revelação animada apenas quando a entrada nasce na sessão
- Branch: `feature/entradas-abiertas-home`, criada a partir da `main` em `500d1a5`, no checkout principal. Mesclada em `b5c0eb6` e removida do remoto
- Acesso ao Figma: o servidor MCP remoto respondeu `sem acesso de edição` para este arquivo. O design foi lido pelo servidor local do Figma Desktop em `127.0.0.1:3845`, que usa a sessão da pessoa usuária. Vale registrar para a próxima tarefa que depender do Figma

### Alterações realizadas

- `src/components/HomeOpenEntries/HomeOpenEntries.tsx` (novo): implementa o nó `497:12722`. O título `Entradas abiertas`, o carrossel com snap, o card do nó `498:13381` e os bullets. As entradas vêm de `getOpenEntrySummaries`, o mesmo serviço da aba `Entradas`, então o limite de uma posição por lado por rodada não precisou de regra nova. O componente devolve `null` sem entradas, e por isso a seção só ocupa espaço quando existe posição aberta.
- `src/components/HomeOpenEntries/HomeOpenEntries.css` (novo): medidas do nó, com `calc(100vw - 40px)` de largura e a mesma composição de borda de `PreviousRounds`. A revelação reaproveita as três animações de uma ronda que chega: `home-open-entry-card-enter` de `860ms`, o brilho diagonal e o pulso de borda, com o acento por lado. A saída após venda total repete a semântica de `open-entry-card-leave`.
- `src/assets/homeEntryLight.svg` (novo): brilho superior do card, exportado do nó `498:13402`.
- `src/App.tsx`: `HomeOpenEntries` montado entre `MarketPriceChart` e `PreviousRounds`, recebendo `roundStart`, posição, custo-base, o `saleExit` já existente e o mesmo `handleEntrySell` da aba `Entradas`.
- Decisão sobre a identidade da revelação: a chave é `roundStart` mais o lado, e o conjunto de chaves conhecidas é semeado na primeira renderização. Assim uma entrada anima uma única vez, chegar à Home com posição já aberta ou recarregar a página permanece neutro, e uma compra na rodada seguinte volta a animar.
- Decisão sobre o que ficou de fora da microinteração: o badge `Nueva` e o aviso `aria-live` de `PreviousRounds` não foram copiados. Numa ronda que chega eles avisam de algo que aconteceu sozinho; aqui a pessoa acabou de comprar e o toaster de sucesso já confirma a operação.
- Decisão sobre o asset: `entryCardLight.svg` e `lightPriceTarget.svg` não foram reaproveitados porque a elipse deste card ocupa toda a largura e usa opacidade de 28%; esticar qualquer um dos dois mudaria o decaimento do brilho.
- Saída reescrita: `home-open-entry-card-leave` perdeu o `translateX` e ficou só opacidade. Com duas entradas, o card que sai recolhe a própria largura mais o vão por `margin-inline-end` negativa, o que puxa a que fica para a posição dele; se o card que sai era o segundo, um scroll suave leva o carrossel de volta ao primeiro. O encaixe automático é desligado enquanto há card saindo. Largura, bullets e a saída da seção passaram a depender de `data-staying-count`, para acontecerem junto com a saída e não depois dela.
- Deixa da revelação corrigida para ser o aviso *daquela* operação, comparado pela referência do objeto de sucesso que `App` passa em `successToast`, e não mais por um booleano de "existe aviso na tela". Dois caminhos faziam a entrada nascer já liberada: repetir o mesmo lado na mesma rodada, que repete a chave da entrada e herdava a deixa anterior; e comprar o segundo lado enquanto o aviso da compra anterior ainda estava visível. Cada revelação nova também passou a esquecer a deixa anterior.
- Largura por quantidade de entradas: com duas, o card mantém `calc(100vw - 40px)` e os `24px` livres à direita que revelam haver um segundo card; com uma, passa a `calc(100vw - 32px)` e ocupa a largura inteira, nas mesmas margens de `16px` do resto da Home. A regra usa o atributo `data-entry-count` que a seção já expunha.
- Encadeamento da revelação, pedido depois do primeiro teste: `App` passa `isSuccessToastVisible`, e o componente segura a entrada nova fora do DOM até o toaster entrar. Aí a seção monta com a altura final do card, ainda invisível, a janela centraliza a seção com scroll suave e só então a revelação roda. O título ganhou fade de entrada e de saída próprios.
- Dois defeitos encontrados ao validar esse encadeamento e já corrigidos. O primeiro: `visibleItems` filtrava pela fase armazenada e não pela derivada, então o card nunca chegava a montar no estado reservado e o scroll era pulado. O segundo: a entrada nova era detectada num efeito, então o card entrava no DOM por uma passada antes de ser escondido; além do risco de piscada, o carrossel se alinhava por essa passada e voltava ao primeiro card. A detecção passou a acontecer durante a renderização.
- Duas correções de especificidade encontradas na validação e já resolvidas: `.home-open-entry-card__row > strong` sobrepunha a cor de `UP`/`DOWN`, que aparecia branca em vez de verde ou vermelha, e a regra do rótulo do rodapé alcançava também o bloco do valor, que perdia a altura de linha de `1.2`.

### Limpeza de assets órfãos

- Uma varredura de referências em `src/`, `index.html` e `public/` apontou cinco arquivos em `src/assets/` que nenhum outro arquivo do projeto citava. Todos foram removidos: `hero.png`, `react.svg` e `vite.svg`, que são sobra do scaffold do Vite — os dois SVG são os logos do template —, além de `logoPulse.svg` e `iconHistorico.svg`, assets de design sem uso, removidos por decisão da pessoa usuária.
- Confirmação de que não entravam no bundle: depois das remoções, os hashes do CSS e do JS do build ficaram idênticos aos anteriores, `index-__nUDO8w.css` e `index-eD50RIQR.js`.
- Se algum desses assets voltar a ser necessário, ele está no histórico do Git.

## Histórico: modal de informação dos cards de preço (PRs #37 e #38)

### Estado no encerramento

- Atualizado em: 2026-09-02
- Agente que entrega: Claude
- Agente esperado a seguir: nenhum
- Status: concluído — implementado, validado, mesclado pelo PR #37 e publicado em `https://design-draftea.github.io/pulse/`. O push, o merge e o deploy foram autorizados pela pessoa usuária
- Objetivo: abrir a mesma explicação em modal de baixo para cima ao tocar nos cards `Precio objetivo` e `Precio actual` do cabeçalho, replicando o comportamento que os cards de métrica do perfil já tinham
- Escopo acordado: apenas os dois cards do `PriceComparison` e o texto de cada um, fornecido pela pessoa usuária. Nenhuma mudança no visual dos cards
- Critérios de aceite: tocar em cada card abre o mesmo modal do perfil, com o título e o texto correspondentes; o modal fecha pelo X, pelo fundo e por `Escape`; os cards de métrica do perfil continuam funcionando como antes
- Branch/worktree: `feature/price-comparison-info-modal`, mesclada pelo PR #37 e removida. O trabalho foi feito em worktree isolado porque a pasta principal tem trabalho não commitado de outra tarefa (aquecimento de assets e conversão para `webp`); por isso a `main` local não foi sincronizada

### Alterações realizadas

- `src/components/InfoModal/`: o modal antes chamado `ProfileInfoModal` foi movido para cá como `InfoModal`, componente compartilhado. As classes CSS passaram de `profile-info-modal__*` para `info-modal__*`. O componente já recebia todo o conteúdo por props, então a generalização foi de nome e de lugar; a marcação, a animação e o CSS continuam os mesmos.
- `src/components/InfoModal/InfoModal.tsx`: três ajustes sobre o original. O tipo `InfoModalContent` foi exportado para servir aos dois donos de conteúdo; `nodeId` virou opcional, porque os cards de preço não têm nó do Figma correspondente a um modal; e o `id` do título, antes a constante `profile-info-modal-title`, passou a vir de `useId`, já que agora existe mais de um dono possível do modal.
- `src/components/InfoModal/InfoModal.tsx`: nova prop opcional `containerClassName`. Ela existe por causa do empilhamento — ver a decisão sobre `z-index` abaixo.
- `src/components/ProfileBottomSheet/ProfileBottomSheet.tsx` e `profileInfoContent.ts`: passaram a importar de `../InfoModal`. `ProfileInfoDefinition` agora estende `InfoModalContent`, então o conteúdo do perfil e o dos preços compartilham o mesmo contrato. Nenhuma mudança de comportamento.
- `src/components/PriceComparison/priceInfoContent.ts`: novo, com os textos de `Precio objetivo` e `Precio actual` exatamente como foram fornecidos, um parágrafo cada.
- `src/components/PriceComparison/PriceComparison.tsx`: os dois cards passaram de `<article>` para `<button type="button">` com `aria-haspopup="dialog"`. O nome acessível vem do próprio conteúdo do card, que já traz rótulo, valor e variação, em vez de um `aria-label` fixo do tipo `Más información sobre …`, que apagaria o valor da leitura. O `<div class="price-comparison__heading">` do card de preço atual virou `<span>`, porque `<div>` não é conteúdo válido dentro de `<button>`.
- `src/components/PriceComparison/PriceComparison.tsx`: estado do modal, devolução do foco ao card que o abriu e trava de rolagem do `body` enquanto ele está aberto, os mesmos três comportamentos que o `ProfileBottomSheet` já implementava.
- `src/components/PriceComparison/PriceComparison.css`: o card recebeu os resets de botão — `appearance`, fundo transparente, `color`, `font-family` e `text-align` herdados —, `cursor: pointer`, `user-select: none` e `-webkit-tap-highlight-color: transparent`, além de um anel de foco visível. Sem o fundo transparente o botão herdaria `buttonface` e apagaria o card, que não declara fundo próprio.

### Decisões

- O modal dos preços é montado por `createPortal` em `document.body`. O `PriceComparison` vive dentro do cabeçalho fixo, que é uma pilha de `z-index: 10` com `backdrop-filter`; um filho `position: fixed` ali dentro ficaria preso abaixo do betslip (`40`) e da Navbar (`30`), e o `backdrop-filter` do ancestral quebraria o posicionamento fixo.
- Fora do portal, o `z-index: 3` que o modal usa no perfil deixa de bastar: no perfil ele herda o contexto de empilhamento do `profile-sheet__container`, que é `2000`. Daí a prop `containerClassName`, usada para aplicar `.price-comparison__info-modal { z-index: 2000 }` e igualar as duas situações sem mexer no valor de origem.
- Os cards não ganharam o ícone de informação que os cards de métrica do perfil exibem ao lado do rótulo. O visual veio do Figma e não fazia parte do pedido. A contrapartida é que a interação não tem indicação visual; se isso for desejado, é uma decisão de design a tomar à parte.

### Validações executadas

- `pnpm lint` e `pnpm build` sem erros.
- Navegador em `375 × 812`, com rodada ao vivo, servidor deste worktree em `localhost:5180`: tocar em cada card abre o modal com o título e o texto certos; fecha pelo X, pelo fundo e por `Escape`; ao fechar, o foco volta ao card que o abriu e a trava de rolagem do `body` é liberada.
- Estado compacto do cabeçalho, com a página rolada: o modal continua abrindo por cima do betslip e da Navbar, e o layout dos cards em `55px` não mudou.
- Regressão do perfil conferida no navegador: `Compras totales` abre o mesmo modal de sempre depois da mudança de nome e de lugar do componente.
- Deploy verificado: o workflow `Deploy Pulse to GitHub Pages` concluiu com sucesso para o merge do PR #37. No bundle publicado estão presentes `info-modal__container` e `price-comparison__info-modal`, no JS e no CSS, e os dois textos dos cards; `profile-info-modal` não aparece em nenhum dos dois arquivos, o que confirma que a renomeação chegou inteira.
- Site publicado conferido no navegador em `375 × 812`: os dois cards são `<button>` e `Precio objetivo` abre o modal com o texto certo.

### Pendências conhecidas

- A interação não tem indicação visual nos cards, conforme a decisão registrada acima.
- Falta validação em toque real. A conferência foi feita no painel do navegador desta sessão, onde o clique automatizado dispara duas vezes seguidas e abre e fecha o modal no mesmo gesto; a abertura foi verificada por clique programático e por captura de tela.
- A `main` local da pasta principal continua em `eb7e7f8`, atrás do `origin/main`, porque tem trabalho não commitado de outra tarefa. Sincronizar é decisão de quem estiver com aquele trabalho.

## Histórico: espanhol e notação de centavos (PRs #33 e #35)

### Estado no encerramento

- Atualizado em: 2026-09-02
- Agente que entrega: Claude
- Agente esperado a seguir: nenhum
- Status: concluído — implementado, validado, mesclado pelos PRs #33 e #35 e publicado em `https://design-draftea.github.io/pulse/`. Cada merge e cada deploy foi autorizado separadamente pela pessoa usuária
- Objetivo: corrigir a notação de centavos do preço médio e levar para espanhol tudo o que havia ficado em português
- Escopo acordado: os quatro pontos identificados numa revisão de compreensão da interface e, depois, as duas pendências que essa primeira correção deixou registradas. A revisão levantou vinte lacunas; as demais não foram tocadas
- Critérios de aceite: nenhum número exibido com `¢` pode trazer também o cifrão; nenhum texto visível, rótulo acessível ou mensagem de erro pode permanecer em português
- Branch/worktree: `fix/copy-espanol-centavos` e `fix/copy-espanol-restante`, mescladas pelos PRs #33 e #35 e removidas; `main` local sincronizada com `origin/main`

### Alterações realizadas

- `src/components/BuyBetslip/BuyBetslip.tsx`: `formatAveragePrice` deixou de prefixar o cifrão. O preço médio era exibido como `$71¢`, com dois símbolos de moeda no mesmo número, no betslip expandido e no resumo recolhido. Os outros seis pontos da interface que mostram centavos já usavam apenas `¢`, então a correção alinhou o betslip ao restante.
- `src/components/BuyBetslip/BuyBetslip.tsx`: o rótulo acessível do handle passou de `Recolher compra` para `Contraer compra`.
- `src/components/BuyBetslip/QuickAmountEditorSheet.tsx`: o botão do rodapé passou de `Salvar` para `Guardar`.
- `src/components/Movements/movementPresentation.ts`: `MONTH_LABELS` passou de `Set.` para `Sep.`, que é a abreviação de setembro em espanhol.

Numa segunda passagem, pelo PR #35:

- `src/components/BuyBetslip/BuyBetslip.tsx`: o rótulo acessível do handle passou a acompanhar o modo, `Contraer ${isSellMode ? 'venta' : 'compra'}`, como o botão de resumo ao lado já fazia. Antes ele era estático e lia `compra` também durante uma venda.
- `src/hooks/useOutcomeMarket.ts` e `src/services/marketData.ts`: as mensagens de `Error` internas passaram para espanhol. `Histórico` virou `Historial` nas duas ocorrências, inclusive na que já estava em espanhol, porque `histórico` como substantivo é lusismo. Nenhuma dessas mensagens chega à interface; todas são engolidas pela contingência.

### Validações executadas

- `pnpm lint` e `pnpm build` sem erros.
- Navegador em `390 × 844`, com dados reais e rodada ao vivo: `77¢` no betslip expandido, `73¢` no resumo recolhido, `Guardar` no rodapé de `Editar montos`, `Contraer compra` no rótulo acessível do handle e `01 Sep. 2026` nos grupos de data de `Movimientos`.
- Após o PR #35, no navegador com rodada ao vivo: o handle lê `Contraer compra` no modo compra e `Contraer venta` depois de alternar para `Vender`.
- Varredura por diacríticos e termos em português nas strings de `src/`: nenhum texto remanescente fora de comentários de código.
- Deploy verificado nas duas entregas: o workflow `Deploy Pulse to GitHub Pages` concluiu com sucesso para os merges dos PRs #33 e #35. Para o PR #33 o bundle publicado foi conferido diretamente, com `Guardar`, `Contraer compra` e `Sep.` presentes, os termos em português ausentes e nenhuma das sete ocorrências de `¢` trazendo cifrão.

### Pendências conhecidas

- As duas pendências abertas pelo PR #33 — o rótulo estático do handle e as mensagens de erro em português — foram fechadas pelo PR #35.
- A revisão de compreensão que originou esta tarefa levantou outras dezenove lacunas ainda abertas, entre elas `Ganancia potencial` exibindo o retorno bruto em vez do lucro, a ausência de qualquer aviso na derrota e os itens `Preguntas frecuentes` sem destino.
## Histórico: arrasto do gráfico (PR #31)

- `src/hooks/usePriceChartPan.ts`: gesto de arrasto por eventos de ponteiro, com trava de eixo em `8px`, captura de ponteiro protegida por `try/catch`, inércia com decaimento de `0,94` por quadro de referência e retorno animado ao vivo em `320ms`. O estado do gesto vive em refs; o contexto lido pelos manipuladores é atualizado por efeito, e não durante o render.
- `src/components/priceChartModel.ts`: `interpolatePriceAt`, `getPriceChartWindowPoints` e `clampPriceChartAnchor` novos; `calculatePriceChartDomain` ganhou a opção `applyTrendShift`, desligada no estado arrastado porque o deslocamento por tendência pressupõe que o último ponto é o presente.
- `src/components/priceChartModel.ts`: `getContinuousVisiblePricePoints` deixou de projetar a série inteira a cada quadro e passou a recortar a janela antes de projetar, o que era necessário com o buffer 7,5 vezes maior. Ganhou também a guarda interpolada da borda direita.
- Defeito encontrado e corrigido durante a validação: sem a guarda da direita, uma janela caindo entre dois pontos de 1 minuto não continha ponto algum e a linha degenerava em um traço horizontal no valor da ponta. Medido no harness antes da correção: `visible: 1` e um caminho com `minY` igual a `maxY`.
- `src/components/PriceChart.tsx`: projeção, eixo temporal, etiqueta de preço, ponto e linha tracejada passaram a usar o instante âncora em vez do presente; indicador direcional, recorte de `30px` e entradas simuladas suprimidos no estado arrastado; botão `En vivo` no lugar do `output` acessível; novos `data-panned`, `data-view-anchor` e `data-window-span` para diagnóstico.
- `src/components/MarketPriceChart/MarketPriceChart.tsx`: passou a ser dona do instante âncora e do vão da janela. O âncora é derivado durante o render a partir de `roundStart`, o que zera o arrasto na virada de rodada sem `setState` em efeito. O domínio ao vivo continua sendo calculado em paralelo, então o retorno ao presente não salta.
- `src/components/PriceChart.css`: `touch-action: pan-y` no gráfico, pílula `En vivo` de `24px` no canto inferior direito e pulso do ponto desligado enquanto arrastado. A geometria da pílula foi ajustada depois de medir colisão com o rótulo de preço inferior: ela ocupa `y` de `230` a `254`, enquanto o último rótulo termina em `227`.
- `src/services/marketData.ts`: `fetchBtcRoundMinutePoints` consulta candles de 1 minuto da Coinbase para a rodada corrente, aproveitando o mesmo endpoint público já usado no histórico de rodadas. Não consulta antes de um minuto decorrido e devolve abertura e fechamento de cada candle, deduplicados na fronteira.
- `src/hooks/useResilientBtcMarketRound.ts`: limite da série de `120` para `901` pontos; novo estado de preenchimento por rodada, com até três tentativas silenciosas; a série publicada junta o preenchimento cortado no primeiro ponto ao vivo. Em desenvolvimento, `?testDataFailure=backfill` força a falha, com chave própria por ser fonte Coinbase.
- `tests/priceChartModel.test.ts`: seis casos novos para interpolação, janela com bordas interpoladas, limites do arrasto, domínio sem deslocamento por tendência, guarda da borda direita e ausência dessa guarda ao vivo.
- `tests/marketData.test.ts`: dois casos novos para o recorte da janela nos candles de 1 minuto e para a ausência de consulta no primeiro minuto.
- Validação: `pnpm lint` sem avisos, `pnpm build` concluído e as seis suítes de teste passando (`chart` 19, `market` 25, `wallet` 19, `fallback` 6, `entries` 8, `proxy` 6).
- Validação no navegador: feita em um harness temporário, já removido, porque o painel do navegador desta sessão fica oculto e o Chrome suspende `requestAnimationFrame` nessa condição, o que congela o laço de render do gráfico. O harness trocava `requestAnimationFrame` por temporizadores. Confirmados: arrasto de `240px` movendo exatamente `10s`, limite à esquerda em `ponto mais antigo + vão da janela`, gesto vertical não arrastando, supressão do indicador e das entradas, domínio acompanhando a janela, linha contínua no trecho de 1 minuto e retorno ao vivo pelo botão.
- Validação no app real em `localhost:5174`: a consulta com `granularity=60` sai na abertura, a série passou a começar exatamente no início da rodada (`data-series-start` igual a `roundStart`) e o arrasto ativa `data-panned` e a pílula `En vivo`.
- Não validado ainda: inércia e retorno animado em uso real, e a convivência do gesto com a rolagem vertical em um toque de verdade. Ambos dependem de `requestAnimationFrame` e de toque real, indisponíveis no painel oculto desta sessão.
- Etapas seguintes concluídas nesta ordem: push da branch, PR #31, merge por commit de merge com remoção da branch, e o deploy automático de `deploy-pages.yml`, cujo build e deploy terminaram com sucesso. Os marcadores da mudança foram conferidos nos assets publicados: `price-chart__live-button`, `price-chart__direction-clear--closed`, `price-chart-value-right`, `live-indicator-size`, `touch-action:pan-y` e `user-select:none` no CSS; `Volver al precio en vivo` e `granularity` no JS.
- Pendência conhecida, não corrigida: abrir a página no primeiro minuto de uma rodada pula o preenchimento daquela rodada. `fetchBtcRoundMinutePoints` devolve vazio antes de um minuto decorrido e o efeito só repete a consulta em caso de erro, não nesse retorno vazio. O impacto é limitado ao trecho entre o início da rodada e a chegada, sempre menor que `60s`, e desaparece na virada seguinte, quando a série é semeada no `roundStart`. A correção seria reagendar a consulta para o instante em que a rodada completa um minuto.

- `src/components/MobileOnly/MobileOnly.tsx`: título, descrição e nota de largura traduzidos para espanhol do México (`Versión solo móvil`, `Esta aplicación fue diseñada exclusivamente para dispositivos móviles.…`, `Ancho máximo compatible: 499px`). Somente conteúdo de texto mudou; marcação, classes e SVG permanecem idênticos.
- Varredura de português no código-fonte: os únicos outros trechos são mensagens internas de `Error` em `src/services/marketData.ts` e um comentário em `src/hooks/useBtcMarketRound.ts`, nenhum deles renderizado na interface. Ficaram como estão.
- `src/components/BuyBetslip/BuyBetslip.tsx` e `.css`: `finishSuccessfulExecution` deixa de chamar `onSuccess` de imediato. Ele marca `isClosing`, o que aplica `buy-betslip--closing` e roda `buy-betslip-exit` por `280ms` no palco, e só então entrega o sucesso, que é o que desmonta o componente. O keyframe espelha `buy-betslip-enter`: `translateY(0 → 24px)` com `scale(1 → 0.98)` e opacidade `1 → 0`. Com `prefers-reduced-motion: reduce`, `onSuccess` é chamado direto e o comportamento anterior é preservado. O padrão segue o `QuickAmountEditorSheet`, que já fechava assim.
- Consequência de sequência: o toaster de sucesso passa a aparecer `280ms` depois, com o betslip já fora da tela, em vez de disputar o mesmo instante.
- `src/components/PurchaseSuccessToast/PurchaseSuccessToast.tsx`: a constante `TOAST_FRAME_NOTCH_CENTER_Y_PX`, fixada em `60`, foi substituída pelo centro do quadro medido, `(top + bottom) / 2`. Os limites que impedem a dobra de invadir os cantos arredondados continuam iguais. O quadro tem `134px` de altura, então o centro correto é `67`; os `60` anteriores deixavam a dobra `7px` acima do meio.
- `src/components/PurchaseSuccessToast/PurchaseSuccessToast.tsx`: as linhas `Participaciones` e `Precio promedio` foram fundidas em `Participaciones: <valor> - <preço>¢`, nas variantes de compra e de venda. O conteúdo caiu de `121px` para `100px`; antes ele excedia os `158px` do toaster e era comprimido pelo `overflow: hidden`.
- `src/components/PurchaseSuccessToast/PurchaseSuccessToast.tsx`: a fusão de linhas vale só para a compra. A venda voltou a duas linhas, `Precio promedio <preço>¢` acima e `Participaciones: <valor>` abaixo, conforme a referência aprovada; o rótulo `Participaciones vendidas` deixou de ser usado. O preço médio passou a constar também no rótulo acessível da venda, já que agora é exibido. Os dois modos ficam com `100px` de conteúdo, então a altura de `140px` serve aos dois.
- `src/components/BuyBetslip/BuyBetslip.css`: o seletor UP/DOWN passou de `40px` para `32px` de altura. Como o palco do betslip tem altura travada por estado, as cinco alturas expandidas foram reduzidas em `8px` — `250→242`, `411→403`, `268→260`, `266→258` e `347→339` — para não deixar folga; o estado recolhido de `56px` não contém o seletor e ficou intacto. A pílula deslizante do controle usa `top`/`bottom` de `4px` e acompanha a nova altura sozinha.
- `src/components/PurchaseSuccessToast/PurchaseSuccessToast.css`: altura de `158px` para `140px`, `padding` do conteúdo de `20px` para `16px` e do overview de `8px` para `4px`, mantendo `20px` de respiro de cada lado. O fundo passou de `object-fit: fill` para `cover`: `bgToasterSucesso.png` é `1404×632` e a altura antiga era exatamente a proporção nativa no viewport de referência de `375px`, então qualquer altura menor achataria o asset. Como ele é um gradiente suave sem detalhe nem borda, recortar preserva a proporção sem artefato visível e dispensa reexportar o PNG.
- `src/components/RoundWinToast/RoundWinToast.tsx`: confetti no aviso de vitória de rodada usando `canvas-confetti` `1.9.4`, a mesma versão e a mesma sequência escalonada de cinco rajadas do Pitaquinho (`src/pages/BetslipPage/BetslipPage.tsx`), com `200` partículas. Um `useRef` garante disparo único e `prefers-reduced-motion: reduce` suprime o efeito.
- Adaptação necessária do preset: o disparo do Pitaquinho parte do rodapé e atira para cima (`origin: { y: 0.9 }`). Reaproveitado como estava, ele tirava as partículas pelo topo em menos de um segundo, verificado por captura vazia. O leque passou a apontar para baixo (`angle: 270`) e a origem foi para fora da tela, acima do topo (`origin: { x: 0.5, y: -0.15 }`), de modo que as partículas entrem caindo em vez de nascerem no aviso. As velocidades iniciais caíram de `25`–`55` para `18`–`35` e `ticks` subiu para `200`, porque a queda percorre a altura inteira em vez de explodir num ponto.
- Cores: somente os roxos, `#4b20ff`, `#7a2bff` e `#9730ff`. O `zIndex` é `119`, logo abaixo dos `120` do toaster, para o texto continuar legível, e acima dos `30` da Navbar.
- Dependência adicionada: `canvas-confetti` e `@types/canvas-confetti`. A justificativa é reproduzir o efeito já aprovado no Pitaquinho por construção, e não por aproximação; o bundle foi de `409,44 kB` para `420,76 kB`, e de `125,01 kB` para `129,38 kB` comprimido.
- Decisão de escopo: o aviso de vitória continua sendo a pílula pequena, sem tratamento visual maior, para não interromper a pessoa usuária. O confetti é o único acréscimo. A confirmação de compra não recebe confetti.
- `src/components/BuyBetslip/BuyBetslip.tsx` e `.css`: `--buy-swipe-knob` e `--buy-swipe-inset` passam a ser publicados inline pelo componente em vez de declarados também no CSS. A matemática do arrasto usa as mesmas constantes, então manter os valores nos dois lados reintroduziria, por outro caminho, a divergência que a correção do preenchimento eliminou.
- `src/components/BuyBetslip/BuyBetslip.tsx`: o `key` de `SwipeToBuy` não inclui mais o monto. O componente deixou de ser destruído e recriado a cada dígito, o que descartava progresso, arrasto e confirmação. O reset de progresso quando o valor muda foi preservado por ajuste no render, seguindo o padrão do React para props que mudam, e o `progressRef` é sincronizado por efeito para não ser tocado durante o render.
- `src/components/RoundWinToast/RoundWinToast.tsx`: `details.roundStart` entrou nas dependências do efeito de permanência, e o disparo do confetti passou a guardar a rodada já celebrada em vez de um booleano. Duas rodadas pendentes liquidando em sequência agora reiniciam os 4s e disparam o próprio confetti; antes a segunda vitória herdava o tempo restante da primeira e não celebrava.
- `src/App.tsx`: o betslip passa a ser montado também na seção `entries`, não só na Home. `Vender` selecionava um lado mas nada era exibido, porque a montagem dependia de `shouldShowHomeAction`. O controle de escolha UP/DOWN continua exclusivo da Home.
- `src/App.tsx`, `src/components/OpenEntries/`: venda total retém o card com um instantâneo de posição e custo-base tirado antes da mutação, porque a carteira muda no início da confirmação e o card sumia cerca de `2,3s` antes do aviso de sucesso. O card só começa a sair quando o aviso aparece, com fade e deslocamento de `40px` para a direita em `320ms`, e deixa a lista no fim da animação. Venda parcial não usa a retenção: o card permanece com números menores.
- `src/services/prototypeWallet.ts`: `PrototypeWalletSettledEntry.outcome` ganhou `'sold'` e `applyWalletSale` passou a gravar a entrada quando a venda zera a posição, com `id` `<roundStart>:<lado>:sold`. Antes, uma posição vendida por completo sumia de `Entradas` inteira: fora de `ABIERTAS` por posição zerada e fora de `PASADAS` porque `settleWalletRound` pula posições zeradas. Sobrevivia apenas como movimento. Toda venda grava, inclusive a parcial. Vendas sucessivas da mesma rodada e lado acumulam na mesma entrada: a primeira versão filtrava a entrada anterior pelo id e reinseria, então a segunda venda substituía a primeira e o card mostrava apenas o último pedaço. Agora participações, custo-base e recebido são somados, e o `Precio de venta` exibido é a média ponderada.
- `src/App.tsx` e `src/hooks/usePrototypeWallet.ts`: a venda passa a receber o preço objetivo da rodada, necessário para o card de `PASADAS`. Sem ele a entrada é gravada com `targetPrice` nulo, sem quebrar.
- `src/components/OpenEntries/OpenEntries.tsx`: o card liquidado trata `sold` com badge `VENTA`, título `VENTA EN <lado>`, `Monto` do custo-base e `Precio de venta` derivado de `payoutCents / participations`. `Precio final` e o indicador de resultado são omitidos, porque a rodada não chegou a ter resultado e o chevron leria como se o lado da entrada tivesse vencido; a divisória vertical do preço objetivo é suprimida por CSS na mesma condição, para não ficar pendurada sem coluna ao lado.
- `src/components/BuyBetslip/BuyBetslip.tsx` e `PurchaseSuccessToast.tsx`: em modo venda a métrica passa de `Precio promedio` para `Precio de venta`, no expandido, no resumo recolhido, no toaster e no rótulo acessível, para o rótulo não divergir do card que aparece em seguida na mesma operação.
- `tests/prototypeWallet.test.ts`: caso novo cobrindo o acúmulo de vendas sucessivas numa entrada só e a média ponderada, mais a sobrevivência da entrada vendida à serialização. O caso de liquidação com venda parcial passou a esperar também a entrada `sold`, já que a saída antecipada e a liquidação do restante convivem.
- `src/App.tsx`: `history.scrollRestoration` passa a `manual` enquanto a aplicação está montada, com o valor anterior restaurado na desmontagem. A Navbar navega por `pushState` e a própria aplicação reposiciona o scroll, então a restauração do navegador só competia com o reset.
- `src/components/BuyBetslip/BuyBetslip.tsx` e `.css`: o preenchimento do controle de deslizar deixa de receber uma largura em pixels calculada no componente e passa a publicar apenas a fração `--buy-swipe-progress`; o CSS converte em largura por `calc()` com porcentagem, que resolve contra a caixa viva do trilho. O estado `trackWidth`, o `useLayoutEffect` de medição e o `ResizeObserver` do trilho foram removidos por terem ficado sem uso. `getMaxTravel` e a decisão de conclusão do gesto já liam a geometria ao vivo e não mudaram.
- Causa do defeito: o `key` de `SwipeToBuy` inclui o monto, então o componente remonta a cada alteração de valor e remedia o trilho enquanto a folha ainda está em transição. A largura transitória ficava congelada no estado e nunca era corrigida, porque nenhum redimensionamento posterior acontecia. Medido antes da correção: trilho real de `300,9px` com preenchimento cheio também de `300,9px`, quando o correto seriam `296,9px`. Conforme a medida congelada fosse maior ou menor que a real, o preenchimento vazava sob o `overflow: hidden` ou parava antes do fim.
- `src/App.tsx`: `window.scrollTo` direto foi trocado pelo auxiliar `resetScrollTop`, que reafirma o topo no frame seguinte quando `scrollY` não zerou. O reset acontece no mesmo instante em que a rota anterior deixa o fluxo e a altura do documento encolhe; medido no navegador, a Home saía de `326` com documento de `1138px` e o reset coincidia com a queda para `812px`. O caminho de cancelamento da transição continua restaurando o `scrollY` original e não usa o auxiliar.

## Histórico anterior (Codex)

- `src/App.tsx`: mantém a última `roundStart` apresentada e envia ao carrossel somente uma rodada concluída mais recente do que a já vista.
- `src/components/PreviousRounds/PreviousRounds.tsx`: comunica ao App o término real de `previous-rounds-card-enter`; com `prefers-reduced-motion`, registra a rodada como apresentada imediatamente.
- A correção funcional foi reaplicada sem conflitos sobre `origin/main` em `72e2269`, que já contém o histórico inicial publicado pelo PR #17; o handoff antigo em conflito foi substituído por este estado atual.

- `src/services/prototypeWallet.ts`: carteira v3 com depósito de `$2,000.00`, quatro entradas liquidadas em três datas recentes, sete movimentos, compras totais de `$320.00`, total recebido de `$360.00`, saldo/portafolio de `$2,040.00` e resultado neto de `+$40.00`.
- `src/hooks/usePrototypeWallet.ts`: chaves v1/v2 removidas na primeira carga da v3; o seed normalizado é persistido imediatamente e `?resetWallet=1` limpa todas as versões antes de restaurá-lo.
- `tests/prototypeWallet.test.ts` e `tests/wonEntries.test.ts`: cobertura do seed, datas relativas, métricas, migração v2→v3, ordenação 2/4 e criação da primeira posição aberta sem alterar o histórico.

- `src/components/OpenEntries/`: chips `ABIERTAS`, `GANADAS` e `PASADAS`, cards abertos e liquidados responsivos; `GANADAS` usa o asset `badgeGanhador.svg`.
- `src/components/OpenEntries/`: `PASADAS` habilitada com cards ganados, perdidos e cancelados; os estados neutros usam os badges `NO GANADOR` e `CANCELADO` conforme os nós `383:14424` e `383:14503`.
- `src/components/OpenEntries/`: indicador ativo compartilhado desliza entre os três chips com a curva de `320ms` do betslip; a listagem faz fade-out de `110ms` e fade-in de `180ms`, com fallback sem movimento para `prefers-reduced-motion`.
- `src/services/wonEntries.ts`: além das ganadas, expõe todas as entradas passadas em ordem decrescente sem alterar a coleção persistida.
- `src/services/prototypeWallet.ts` e `src/hooks/usePrototypeWallet.ts`: a carteira v2 passa a persistir as entradas liquidadas com lado, custo-base, participações, pagamento, preço objetivo e preço final, mantendo compatibilidade com estados v2 anteriores.
- `src/services/wonEntries.ts`: filtro determinístico das vencedoras, ordenadas da rodada mais recente para a mais antiga.
- `src/App.tsx`: liquidação ao vivo e de rodadas restauradas fornece todos os dados necessários ao histórico de Ganadas.
- `origin/main` atualizada até `8f31ec8`: Perfil, contagem animada das métricas, Movimientos publicado, correção de blur e transição de rotas foram integrados; `Entradas` agora participa do mesmo fade-through da Navbar, inclusive em voltar/avançar.
- `tests/prototypeWallet.test.ts` e `tests/wonEntries.test.ts`: cobertura de liquidação, custo-base após venda parcial, persistência, filtro e ordenação.

- `vite.config.ts`: caminho-base configurável por `VITE_BASE_PATH`, mantendo `/` no desenvolvimento e usando `/pulse/` no artefato do GitHub Pages.
- `src/services/marketData.ts`: preço objetivo usa `VITE_POLYMARKET_PROXY_ORIGIN` em produção; quando a variável não existe, entra imediatamente na contingência silenciosa já aprovada.
- `infra/polymarket-proxy/`: Cloudflare Worker público, sem credenciais de produto, restrito a consultas GET válidas de BTC em janelas exatas de 15 minutos, com CORS e cache curto.
- `.github/workflows/deploy-pages.yml`: instalação, testes, lint, build e publicação do `dist` no GitHub Pages.
- `.github/workflows/deploy-market-proxy.yml`: publicação manual do Worker usando secrets da conta Cloudflare do repositório.
- `tests/polymarketProxy.test.mjs`: cobertura de health check, CORS, caminhos/métodos bloqueados, validação da rodada, encaminhamento e falha da origem.
- `README.md` e `infra/polymarket-proxy/README.md`: execução local, arquitetura de publicação e configuração necessária documentadas.

- `src/services/quotePresentation.ts`: tipos `PresentedQuoteSnapshot` e `QuoteProtectionResult`, regras puras de publicação visual e proteção simétrica de `1¢` para compra e venda.
- `src/hooks/usePresentedQuotes.ts`: snapshots atômicos para `MarketChoice`, monto livre, venda e as três opções de `Un toque`; mercado continua interno a `250ms`, enquanto a apresentação automática fica limitada a uma vez por segundo.
- `src/components/MarketChoice/`, `src/components/BuyBetslip/` e `src/components/PurchaseSuccessToast/`: percentuais estabilizados; textos visíveis preservados como `Precio promedio`, `Ganancia potencial` e `Monto a recibir`; a proteção de `1¢` permanece interna, sem linha permanente, e só o feedback acessível de recotação/indisponibilidade aparece quando necessário.
- `src/components/BuyBetslip/` e `src/App.tsx`: compra e venda revalidam no livro mais recente, alteram carteira/posição no início da confirmação e congelam a cotação aceita; o loading de `2s` não recalcula nem permite interação, e o toaster usa exatamente os detalhes executados.
- `src/hooks/useOutcomeMarket.ts`: `ExecutionQuote.quotedAt` passa a refletir o timestamp do snapshot real ou sintético do livro.
- `tests/quotePresentation.test.ts`: onze cenários para tolerância, direção da venda, dados inválidos, rodada/pedido divergentes, intervalo de `1s`, limiar de `1¢`, disponibilidade e cotações independentes de `Un toque`.
- Desenvolvimento: `?testQuoteReprice=buy|sell|both` força uma piora única de `2¢` por operação/rodada para tornar a recotação determinística.

- `src/components/priceChartModel.ts`: modelo puro para buffer ordenado/deduplicado por rodada, lacunas, domínio, histerese, interpolação de `280ms` e continuidade na borda esquerda.
- `src/hooks/useResilientBtcMarketRound.ts`: série limitada a 120 pontos, preservada durante troca/reconexão e reiniciada apenas quando `roundStart` muda, com o último preço válido como seed.
- `src/components/PriceChart.tsx` e `MarketPriceChart`: linha ancorada em `x=0`, domínio de renderização animado, série sempre na opacidade final inclusive na troca de rodada e diagnósticos invisíveis de série, fonte, lacunas, continuidade e motivo do reset.
- `tests/priceChartModel.test.ts`: nove cenários determinísticos para buffer, deduplicação, limite, virada, continuidade, lacunas, expansão, contração, tendência e interpolação.
- `src/services/marketPriceDirection.ts`, `src/hooks/useAnimatedMarketPrice.ts` e `PriceChart.css`: direção baseada em janela de `1,5s`, confirmação por duas leituras, ciclos completos de `740ms` com pausa de `120ms`, inversão somente na fronteira do ciclo e neutralização após `2s` sem movimento relevante; o fade duplicado do contêiner foi removido.
- `tests/marketPriceDirection.test.ts`: quatro cenários para confirmação, inversão, ruído isolado e expiração da tendência.

- `src/services/marketData.ts`: geração determinística das dez janelas anteriores a partir do início da rodada atual; a consulta oficial valida a sequência mais recente antes de publicar o histórico.
- `src/services/marketData.ts`: fallback com candles reais de 15 minutos da Coinbase preenche somente as janelas em que a Polymarket não respondeu, preservando os valores da Polymarket quando disponíveis.
- `src/hooks/useBtcMarketRound.ts`: sincronização imediata do relógio e nova consulta do histórico ao carregar, virar a rodada e retornar à página por foco, `pageshow` ou visibilidade.
- `src/hooks/useResilientBtcMarketRound.ts`: cache e respostas são filtrados pela lista exata dos dez `roundStart` esperados, evitando que rodadas antigas ocupem lacunas recentes.
- `tests/marketData.test.ts`: cobertura da janela `10:15–10:30`, cuja primeira rodada anterior é `10:00–10:15` e a décima é `07:45–08:00`.

- `src/services/marketFallback.ts`: funções puras para frescor/prioridade dos feeds, probabilidade complementar de `3%` a `97%`, suavização, livro sintético de cinco níveis e cache seguro de até 12 rodadas.
- `src/hooks/useBtcPriceFeeds.ts`: Chainlink, Coinbase e Kraken conectados em paralelo, stale timeout de `10s`, troca silenciosa sem zerar o preço e parâmetros de falha exclusivos de desenvolvimento.
- `src/hooks/useResilientBtcMarketRound.ts`: alvo oficial/cache/virada bloqueado por rodada, persistência de alvo/final/resultado, histórico local e liquidação de rodadas durante falha oficial.
- `src/hooks/useOutcomeMarket.ts`: livro local imediato enquanto conecta, bloqueio local após `3s`, falha do CLOB ou interação, persistência do bloqueio após F5 e retorno à Polymarket somente na rodada seguinte.
- `src/App.tsx`: consumo dos hooks resilientes, liquidação pelo histórico cacheado e diagnósticos invisíveis em `data-*`.
- `tests/marketFallback.test.ts`: seis testes de prioridade/frescor, limites, complementaridade, suavização, profundidade/liquidez, compra/venda e cache corrompido/limitado.
- `src/components/MobileOnly/MobileOnly.tsx`: aviso copiado da implementação-fonte do Draftaco.
- `src/components/MobileOnly/MobileOnly.css`: breakpoint, dimensões, tipografia, cores e espaçamentos equivalentes.
- `src/App.tsx`: aviso montado sobre a aplicação.
- `src/components/Header/`: header próprio com logo, saldo, ação de adicionar saldo e perfil.
- `src/assets/`: assets locais do header e fundo fixo.
- `src/styles/tokens/mode-1.tokens.json`: export original dos tokens do Figma, com 80 tokens de cor em 39 valores hexadecimais.
- `src/styles/tokens/colors.css`: variáveis CSS dos dois extremos do gradiente primário já consumido pelo header.
- `src/components/Header/`: botão de saldo corrigido com círculo de `32px` e gradiente primário do Figma.
- `src/components/SubHeader/`: componente de `64px` montado abaixo do header conforme o nó `188:2920`, com identificação da rodada e contador estático inicial.
- `src/components/SubHeader/`: estado compacto de `40px` conforme o nó `198:3358`, integrado à pilha fixa compartilhada com o PriceComparison.
- `src/assets/logoBTC.png`: asset local utilizado pelo `SubHeader`.
- `src/components/PriceComparison/`: preço objetivo e preço atual reais, diferença calculada e direção UP/DOWN correspondente, mantendo o layout dos nós `188:2941` e `198:3376`.
- `src/components/PriceComparison/`: mesma instância logo abaixo do `SubHeader`, animando para `55px` conforme o nó `198:3376` dentro da pilha fixa compartilhada.
- `src/components/PriceComparison/PriceComparison.css`: borda visível movida para uma camada interna com o token de 12%, preservando o espaço transparente de `1px` e reproduzindo o stroke `Inside` sem deslocar o conteúdo.
- `src/assets/lightPriceTarget.svg`, `lightPriceCurrent.svg` e `arrowUpGreen.svg`: assets locais utilizados pelos cards de preço.
- `src/components/PreviousRounds/`: carrossel `Últimas 10 rondas` com as 10 rodadas reais concluídas mais recentes conforme o nó `188:3013`, formatando horário local, data, preço objetivo, preço final e resultado.
- `src/components/PreviousRounds/PreviousRounds.css`: borda dos cards movida para uma camada interna de `1px` com o token de 12%, preservando o espaço estrutural transparente e a largura do carrossel.
- `src/assets/iconClock.svg`, `iconDoubleChevronsUp.svg` e `iconDoubleChevronsDown.svg`: assets locais utilizados nos cards das rodadas.
- `src/components/PulseFooter/`: footer informativo responsivo conforme o nó `188:3060`, com logo, explicação e os links estáticos `Términos y condiciones`, `Aviso de privacidad`, `Preguntas frecuentes` e `Soporte`.
- `src/assets/iconChevronRight.svg`: asset local reutilizado nos links do footer.
- `src/components/Navbar/`: navbar inferior fixa e responsiva, com Home ativo e Movimientos/Entradas inativos.
- `src/components/Navbar/Navbar.css`: fade preto inferior da variante `navbar--liquid-v2` do Draftaco adaptado como camada atrás da Navbar do Pulse, incluindo a área segura inferior.
- `src/assets/iconHomeActive.svg`, `iconMovimientos.svg` e `iconEntradas.svg`: assets locais atualizados utilizados na navbar.
- `src/components/Navbar/` e `src/App.tsx`: `Entradas` recebe um ponto vermelho com onda pulsante quando a carteira possui participações UP ou DOWN na rodada atual; o estado deriva diretamente da posição persistida e inclui nome acessível `Entradas, participación activa`.
- `src/components/MarketChoice/`: os botões UP/DOWN agora abrem o betslip já com o lado escolhido.
- `src/components/MarketChoice/`: percentuais fixos removidos; cada lado usa o preço ativo da Polymarket ou da contingência local sem indicar a origem na interface.
- `src/components/MarketChoice/`: nos últimos `5s`, os botões são bloqueados e substituídos por `Cerrando ronda…`; um betslip aberto é desmontado antes do fechamento.
- `src/components/RoundWinToast/`: toast compacto do nó `320:13133`, exibido somente para uma participação vencedora, com valor total recebido, entrada e saída equivalentes ao toast de compra.
- `src/assets/iconRoundWin.svg`: export exato do ícone circular de confirmação usado no nó `320:13133`.
- `src/components/BuyBetslip/`: novo componente responsivo com estados expandido, teclado e recolhido; troca UP/DOWN, edição de monto, teclado numérico, handle e confirmação por deslize.
- `src/components/BuyBetslip/`: `SIDE_PRICE` e `SIDE_PERCENTAGE` removidos; monto livre, cada valor de `Un toque` e venda calculam VWAP na profundidade correspondente. A confirmação congela a cotação e novas participações permanecem disponíveis na mesma rodada.
- `src/components/BuyBetslip/` e `src/components/PurchaseSuccessToast/`: venda deixou de recolher o betslip; agora executa loading de `2s` com bloqueio global, remove as participações vendidas, desmonta o betslip e exibe `¡VENTA EN UP/DOWN!` com monto recebido, participações e preço médio.
- `src/App.tsx` e `src/services/outcomeMarket.ts`: posições UP/DOWN começam em `0/0` e voltam a `0/0` na troca da rodada; uma compra confirmada acrescenta participações somente ao lado executado para disponibilizá-las em `Vender`.
- `src/hooks/useOutcomeMarket.ts`: descoberta do slug atual pela Gamma, assinatura dos tokens UP/DOWN no canal CLOB, snapshots, deltas, última negociação, heartbeat, reconexão e publicação limitada a quatro atualizações por segundo, com livro local silencioso na indisponibilidade.
- `src/services/outcomeMarket.ts`: tipos `OutcomeMarketState` e `ExecutionQuote`, mapeamento outcomes/tokens, manutenção do livro, regra de exibição e VWAP de asks/bids.
- `tests/outcomeMarket.test.ts`: dez testes unitários das posições iniciais, entrada da compra, baixa da venda no lado executado, mapeamento, midpoint, última negociação, snapshot/deltas, VWAP e liquidez insuficiente.
- `src/services/prototypeWallet.ts`: carteira local versionada com saldo em centavos, posições UP/DOWN por rodada, histórico limitado de créditos aplicados e mutações puras de compra, venda e liquidação.
- `src/hooks/usePrototypeWallet.ts`: restauração e persistência no `localStorage`, revalidação atômica das operações, sincronização pelo evento `storage`, liquidação de rodadas pendentes e reset por `?resetWallet=1`.
- `src/components/Header/` e `src/App.tsx`: balance substituído por valor dinâmico em USD; compra, venda e resultado agora atualizam saldo e posição pela carteira centralizada.
- `src/components/BuyBetslip/`: deixou de alterar posições diretamente; valores acima do saldo exibem `Saldo insuficiente`, bloqueiam o swipe e desabilitam opções de `Un toque`, mantendo a compra exata do saldo permitida.
- `src/services/marketData.ts`: expõe a consulta validada de uma rodada concluída para liquidar posições restauradas após F5 quando o resultado oficial estiver disponível.
- `tests/prototypeWallet.test.ts`: onze testes para saldo inicial, restauração, compra parcial/total, saldo insuficiente, venda parcial/total, vitórias UP/DOWN, derrota, venda antes do encerramento, rodadas pendentes e créditos idempotentes.
- `src/assets/iconChange.svg`, `iconEdit.svg`, `iconDelete.svg` e `iconCheck.svg`: exports exatos do Figma usados no novo fluxo.
- `src/App.tsx`: estado do lado selecionado e alternância entre `MarketChoice` e `BuyBetslip`.
- `src/App.tsx`: snapshot do último preço válido na virada, cálculo imediato do resultado e registro em memória das compras da rodada para compor a mensagem personalizada sem persistir saldo.
- `src/App.tsx` e `RoundWinToast`: modo local `?previewRoundResult=won` conta de `00:05` até `00:00` e reproduz o toast vencedor temporário; derrotas e rodadas sem compra não criam feedback de resultado.
- `src/App.tsx` e `src/components/PreviousRounds/`: a rodada encerrada entra imediatamente como o primeiro card usando o snapshot local, sem aguardar a confirmação da API; a resposta oficial substitui os valores pela mesma `roundStart`, sem duplicar ou reiniciar a animação.
- `src/components/PreviousRounds/`: somente o card realmente adicionado na virada anima; o carregamento inicial permanece neutro. A nova rodada é revelada da esquerda para a direita durante `860ms`, recebe brilho e borda temporários na cor do resultado e acompanha um badge `Nueva` de `1,8s`; uma região `aria-live` anuncia a atualização e o resultado.
- `src/components/PriceChart.tsx`, `PriceChart.css`, `priceChartGeometry.ts`, `priceChartLayout.ts` e `entryFeedCadence.ts`: implementação responsiva do gráfico importada da tarefa `Implementar gráfico dinâmico do BTC`.
- `src/components/PriceChart.tsx` e `src/components/MarketPriceChart/MarketPriceChart.tsx`: preços limitados a duas casas decimais e grade com 7 níveis; domínio calculado pelos 20 pontos recentes, intervalo-base de `$2,50` e expansão automática para `$5`, `$10` ou mais em maior volatilidade. O eixo temporal usa marcações a cada `5s`. Todos os rótulos do eixo continuam renderizados, inclusive o nível atrás da etiqueta atual. A tendência dos seis pontos mais recentes desloca o domínio em dois intervalos quando o preço entra nas duas faixas superiores ou inferiores, criando espaço antecipado na direção do movimento; os sete níveis mantêm posições e opacidade estáveis e apenas atualizam seus valores durante a interpolação de `280ms`, sem fade.
- `src/components/MarketPriceChart/MarketPriceChart.tsx`: série real recebida do Chainlink TWAP via Polymarket RTDS e domínio vertical recalculado conforme preço objetivo e dados visíveis.
- `src/hooks/useResilientBtcMarketRound.ts`: estado da rodada, relógio regressivo, janela de 15 minutos, alvo bloqueado, feeds resilientes, histórico persistido, frescor e reconexão automática; a virada reutiliza imediatamente o último preço válido e registra os novos pontos pelo horário de recebimento.
- `src/hooks/useAnimatedMarketPrice.ts`, `src/App.tsx`, `PriceComparison` e `PriceChart`: animação centralizada de `360ms` para o preço atual; card, diferença, ponto e etiqueta do gráfico compartilham o mesmo valor em cada frame, enquanto a seta usa a tendência estabilizada em um ciclo independente.
- `src/hooks/useMockChartEntries.ts`, `src/App.tsx` e `MarketPriceChart`: restaurada a alimentação simulada das entradas que sobem no gráfico; UP usa verde, DOWN usa vermelho e a sequência fica isolada dos dados reais de preço.
- `src/services/marketData.ts`: cálculo determinístico da rodada, busca validada do `openPrice` atual e consulta paralela das rodadas concluídas com `openPrice` e `closePrice` da Polymarket.
- `vite.config.ts`: proxy local para a rota de preço da Polymarket, necessário porque a origem não expõe CORS ao navegador.
- `src/assets/arrowDownRed.svg`: direção negativa usada pela comparação real de preços.
- `docs/MARKET_DATA_SPIKE.md`: prova técnica trazida para a branch e complementada com a decisão aplicada nesta implementação.
- `src/components/PriceChart.tsx` e `PriceChart.css`: sincronizados com a revisão atual da tarefa do gráfico, incluindo chevrons animados inline; o fundo preto do indicador foi removido e o fade lateral passou de sobreposição preta para máscara transparente.
- `src/components/PriceChart.css`: indicador refinado para uma sequência única de aproximadamente `740ms`, com cada chevron animando por `620ms`, diferença de `120ms` e deslocamento direcional sutil.
- `src/hooks/useAnimatedMarketPrice.ts` e `src/components/PriceChart.tsx`: seta desacoplada dos `360ms` da animação numérica; atualizações na mesma direção não reiniciam o glyph, cada sequência termina pelo evento real do segundo chevron e possui fallback de `800ms`. A zona limpa permanece após o desaparecimento.
- `src/components/PriceChart.tsx`: máscara lateral ampliada para `96px` e suavizada com progressão equivalente a smoothstep, reduzindo a borda perceptível no preenchimento da área.
- `src/components/PriceChart.tsx` e `PriceChart.css`: zona limpa quadrada de `30px` atrás dos chevrons, recortando linha, área e grids; círculo e contorno visual removidos.
- `src/components/PriceChart.tsx`: tooltip nativo removido do SVG; o nome e a descrição acessíveis permanecem disponíveis por `aria-label` e `aria-describedby`.
- `src/App.tsx`: gráfico montado imediatamente antes de `PreviousRounds`.
- `src/styles/tokens/colors.css`: variáveis semânticas adicionais já existentes no design para betslip, teclado e ganho.
- `src/App.css`: estrutura mobile e `bgHeader.png` fixo abaixo do conteúdo, limitado a `300px` de altura.
- `src/App.css`: altura artificial de `200svh` removida; o scroll agora é determinado somente pelo conteúdo real da página.
- `src/App.css`: pilha de mercado alterada de uma troca por JavaScript para `position: fixed` para `position: sticky` nativo; o estado de scroll agora altera apenas a compactação, eliminando o salto no momento da fixação.
- `src/App.tsx` e `src/App.css`: o fundo da pilha sticky deixou de depender do evento de scroll; agora é opaco desde o primeiro frame e usa o mesmo asset alinhado ao viewport, evitando vazamento visual do gráfico em scrolls rápidos.
- `index.html`: Red Hat Display, Red Hat Text e idioma `es-MX`.
- `docs/AI_CONTEXT.md`: decisão mobile-only e breakpoint registrada.
- `design-qa.md`: evidências disponíveis e bloqueio visual documentados.

## Validações executadas

### Publicação (PRs #45 e #46)

- `Deploy Pulse to GitHub Pages` concluiu com sucesso nas duas execuções, a de `1e41dc6` e a de `b7171d9`, esta última em `10s` no passo de deploy.
- `https://design-draftea.github.io/pulse/` respondeu `200`. Os marcadores foram conferidos nos assets publicados: no CSS, `profile-sheet__stage`, `profile-sheet__route--past`, `profile-sheet__title--visible`, `help-action-glow`, `blur(44px)` e `help-glossary-line`; no JS, `Esencial en Draftea`, `Glosario en Draftea`, `initialMode` e `onHelpOpen`.
- O `scale(1.006)` do repique do modal de movimento não aparece mais no CSS publicado, confirmando que o PR #46 também está no ar.

### Entrada do Centro de ayuda pelo rodapé (`feature/ajuda-hf`)

- `pnpm lint` sem avisos e `pnpm build` concluído com typecheck.
- Dos quatro botões do rodapé, apenas `Preguntas frecuentes` tem `onClick`; os outros três continuam sem ação.
- Percurso conferido: avatar abre em `Mi perfil`; fechar e clicar em `Preguntas frecuentes` no rodapé abre direto em `Centro de ayuda`, com a rota de ajuda em `x=0` e o perfil estacionado em `-380px`; e o avatar continua abrindo em `Mi perfil`.
- Seta de voltar conferida nos cinco estados, por classe, `aria-hidden`, `tabIndex` e `disabled`: pelo rodapé, a ajuda é raiz e não tem seta; entrar no glossário a partir dali mostra a seta; voltar para a ajuda a esconde; pelo avatar, o perfil é raiz e não tem seta; e a mesma tela de ajuda, alcançada pelo avatar, passa a ter seta.
- Ressalva do ambiente, a mesma da navegação: com o painel oculto, as transições de `opacity` do título ficam congeladas no valor anterior mesmo depois de segundos, embora o React já tenha trocado as classes e o `aria-hidden`. Desligando as transições, o estado final lido foi o correto: `Mi perfil` em `1`, `Centro de ayuda` e `Glosario` em `0`, perfil em `x=0` e seta de voltar em `0`. O estilo temporário foi removido em seguida.

### Navegação do bottom sheet (`feature/ajuda-hf`)

- `pnpm lint` sem avisos e `pnpm build` concluído com typecheck.
- Navegador em `localhost:5173`, viewport de `375x812`. As transições foram medidas por estilo computado no meio do trajeto, e não por captura, porque a captura chega depois dos `300ms`.
- Perfil para Centro de ayuda: em `120ms` o perfil estava em `-213px` com opacidade `0,43` e a ajuda em `167px` com `0,56`; em `420ms` os dois já estavam assentados em `-380px` e `0`, e a seta de voltar em opacidade `1` e habilitada.
- Centro de ayuda para glossário e volta: na ida, a ajuda saiu para `-212px` e o glossário entrou de `168px`; na volta, a ajuda voltou de `-194px` e o glossário saiu para `186px` e depois `380px`. Os títulos acompanharam, com `Centro de ayuda` em `0,07` no meio da ida e `Glosario` em `0,15` no meio da volta.
- Pergunta do FAQ: o texto da pergunta continuou presente durante toda a saída, em `140ms` e em `237px`, e só ficou vazio depois que a rota chegou a `380px`. O título permaneceu `Centro de ayuda` na ida, sem piscar.
- Depois de recarregar a página, as quatro rotas têm cada uma o seu contêiner de rolagem, todos com `564px` de altura visível, e só a rota ativa fica sem `inert`. O carrossel horizontal de métricas do perfil continua rolando, com `711px` de conteúdo em `380px` de visível.
- O estilo temporário usado para desacelerar a transição foi removido e a página recarregada; a ausência dele foi conferida depois da recarga.
- Rolagem zerada na troca de tela, conferida por `scrollTop`: com o perfil em `300` e o Centro de ayuda em `380`, entrar no glossário e voltar devolveu a ajuda em `0`; voltar de novo devolveu o perfil em `0`; e reentrar no glossário, que tinha ficado em `700`, mostrou o primeiro termo, `Bitcoin`, com `scrollTop` em `0`.
- Ressalva do ambiente: nesta sessão o painel do navegador fica com `visibilityState` em `hidden`, então o Chrome estrangula os temporizadores e quase congela o `requestAnimationFrame`. Um `setTimeout` de `300ms` levou de `461ms` a `890ms`. Por causa disso a trava de `300ms` de `isRouteTransitioning` mantém a seta de voltar desabilitada por mais tempo aqui, e um clique dado cedo demais é engolido. Não é defeito do código: as medições foram refeitas com esperas de `2s` e a navegação respondeu a todos os cliques. Ainda assim, vale conferir num aparelho real.

### Glossário do Centro de ayuda (`feature/ajuda-hf`)

- `pnpm lint` sem avisos e `pnpm build` concluído com typecheck.
- Navegador em `localhost:5173`, viewport de `375x812`, no caminho perfil → `Preguntas frecuentes` → `Glosario en Draftea`.
- Estilo computado conferido contra o nó `467:10540`: contêiner com `padding` de `16px` e `gap` de `24px`, `gap` real de `24px` entre termos, caixa com `gap` de `4px` e `align-items: flex-start`, coluna do traço com `16px` de largura e `12px` de respiro vertical, traço de `16x1px` em `rgb(251, 251, 251)` a `12px` do topo da caixa, conteúdo com `gap` de `2px` e `flex: 1 0 0`, termo em `700` a `16/24` em `#fbfbfb` e definição em `400` a `14/21` em `rgba(251,251,251,0.7)`.
- Os doze termos foram percorridos até `Liquidación` com rolagem até o fim. O título interno duplicado não existe mais e a seta de voltar retorna ao Centro de ayuda.
- Observação, anterior a esta mudança: ao voltar do glossário o contêiner de rolagem mantém a posição em que estava, então o Centro de ayuda reaparece rolado no meio das `Preguntas frecuentes`. A rolagem é do mesmo elemento nos dois modos e não foi tocada aqui.

### Atalhos do Centro de ayuda (`feature/ajuda-hf`)

- `pnpm lint` sem avisos e `pnpm build` concluído com typecheck.
- Navegador em `localhost:5173`, viewport de `375x812`, no bottom sheet de perfil, em `Preguntas frecuentes`.
- Estilo computado conferido contra o nó `457:8806`: `gap` de `12px` entre título e linha, título em `700` a `16/24` em `#fbfbfb`, linha com `gap` de `8px` e `align-items: center`, cards de `111x116` com raio `16px`, `padding` de `12px`, `gap` de `16px` e `overflow: clip`, bordas em `rgba(251,251,251,0.08)` no primeiro e `rgba(251,251,251,0.12)` nos outros dois, brilhos de `50x50` com `blur(44px)` em `#2dd4bf`, `#fbfbfb` e `#fde047`, ícones de `32x32` e rótulos de `42px` em `500` a `14/16` em `rgba(251,251,251,0.7)`, centrados.
- Comportamento preservado: o card `Glosario en Draftea` continua abrindo o glossário, e a seta de voltar retorna ao Centro de ayuda. Os outros dois seguem sem ação, como antes.
- Viewport de `320px` conferido: os rótulos passam a três linhas e transbordam a caixa de `42px`, mas ficam dentro do `padding` de `12px` do card e nada é recortado. A altura fixa foi mantida porque é ela que conserva os três cards com a mesma altura, já que a linha do Figma usa `align-items: center` e não estica os cards.

### Cor das setas de direção do gráfico (`feature/setas-grafico-cor-direcao`)

- `pnpm lint` sem avisos e `pnpm build` concluído com typecheck.
- Navegador em `localhost:5173`, viewport de `375x812`. Estilo computado confirmou `rgb(52, 211, 153)` no chevron do estado `--up` e `rgb(248, 113, 113)` no do estado `--down`.
- Os dois estados foram conferidos visualmente na Home. Como os chevrons piscam por `620ms` a cada atualização de preço, a animação foi congelada por um estilo temporário só para a captura, e o estilo foi removido com recarga da página logo depois.
- Publicação verificada em `https://design-draftea.github.io/pulse/` após o merge: mesmos valores computados, `rgb(52, 211, 153)` e `rgb(248, 113, 113)`. O workflow `Deploy Pulse to GitHub Pages` concluiu com sucesso em 41s.
- Os erros de console observados são os mesmos de rede já registrados nas pendências, `502` da Polymarket e WebSocket sem conexão, anteriores a esta mudança. Durante a validação o feed ativo era o da Coinbase, ao vivo, e o mercado UP/DOWN estava na contingência local.

### Resumo de entradas abertas na Home (`feature/entradas-abiertas-home`)

- `pnpm lint` sem avisos e `pnpm build` concluído com typecheck. As sete suítes somaram 86 testes aprovados e nenhuma falha (`chart` 19, `market` 25, `wallet` 19, `entries` 8, `fallback` 6, `proxy` 6, `assets` 3).
- Navegador em `localhost:5176`, viewport de `375px`. A seção mede `202px` de altura, exatamente a altura do nó no Figma, e o card mede `335x116` a partir de `x=16`, pela mesma convenção responsiva de `PreviousRounds`.
- Conferidos por estilo computado: grade de duas colunas com `2px`, rótulos em `rgba(251,251,251,0.5)` a `12/18`, `DOWN` em `#f87171` e `UP` em `#34d399`, rodapé com borda superior de 12% e `8px` de topo, valor em `900` a `16px` com altura de linha `19.2px`, botão de `120x32` com raio `10px` e o degradê `75.115deg` de `actionPrimaryDefault`, brilho posicionado a `-35px` do topo do card.
- Estados verificados: sem posição a seção não existe e a Home volta a ser gráfico, `Últimas 10 rondas` e rodapé; com uma entrada o carrossel não mostra bullets e a seção cai para `188px`; com duas entradas os dois bullets aparecem, o segundo card entra por snap e o bullet ativo acompanha a rolagem.
- Revelação: ao surgir uma posição durante a sessão o card recebe `home-open-entry-card--entering` com as três animações. Como o painel do navegador ficou oculto nesta sessão, o relógio de animação estava congelado; a animação foi percorrida pela Web Animations API e capturada no meio do caminho, com o card revelado da esquerda para a direita e a borda pulsando em vermelho no lado `DOWN`. A limpeza da classe foi exercitada por `animationend` sintético: o evento do pseudo-elemento é ignorado e só o da própria animação de entrada limpa o estado.
- `Vender` do card `UP` abriu o betslip em `buy-betslip--sell` com `150.5 participaciones`, `Precio de venta` e `Monto a recibir`, igual à aba `Entradas`.
- Venda total executada de ponta a ponta pelo caminho de teclado do controle de deslize: a posição `UP` foi a zero, o saldo foi creditado, o card ficou retido com `home-open-entry-card--leaving` e saiu da lista ao fim da animação, sem afetar o card `DOWN`.
- Encadeamento completo medido numa compra real, disparada pelo caminho de teclado do controle de deslize: o card não existe no DOM em nenhum momento durante os `2s` de loading; quando o toaster entra, a seção monta e a janela vai de `scrollY 0` para `246`, deixando a seção em `220..408` numa janela de `628px`, ou seja, centro da seção e centro da janela ambos em `314`; só então o card é revelado.
- Saída medida com amostragem: no instante do aviso de venda, cabeçalho e card recebem juntos `--leaving` com `home-open-entries-heading-leave` e `home-open-entry-card-leave`, e a seção deixa o DOM cerca de `360ms` depois.
- Saída medida percorrendo a animação quadro a quadro, com duas entradas e vendendo a primeira: o card que sai fica em `x=16` do começo ao fim e só apaga (`1`, `0,91`, `0,68`, `0,38`, `0`), enquanto o que fica desliza de `x=341` para `x=16`. Vendendo a segunda depois de rolar até ela, o carrossel volta de `scrollLeft 317` para `0` com scroll suave e o encaixe automático fica em `none` durante a saída, voltando a `x mandatory` no fim.
- Regras de saída conferidas por estilo computado nos dois cenários: com uma entrada ficando, o card que sai roda `leave` e `collapse`; sendo a única entrada, roda apenas `leave`.
- Deixa conferida nos três caminhos, com a carteira alterada por evento de armazenamento: primeira compra em DOWN, repetição de DOWN na mesma rodada depois de vender, e compra do segundo lado com uma entrada já aberta. Nos três o card fica fora do DOM até a liberação. Antes da correção, a repetição de DOWN entrava na hora.
- Deixa real do toaster confirmada elevando temporariamente a salvaguarda para `60s`: numa compra real o card ainda apareceu, ou seja, quem liberou foi o aviso e não o tempo limite.
- Largura medida numa janela de `357px`: com uma entrada o card vai de `16` a `341`, com `16px` de folga dos dois lados e sem bullets; com duas, os cards ficam com `317px` e o primeiro mantém `24px` livres à direita, com os dois bullets visíveis.
- Segunda entrada: comprar o outro lado com uma entrada já aberta não reanima o título, leva o carrossel para o card revelado (`scrollLeft` no máximo de `317`, bullet ativo no índice 1) e mantém essa posição depois que a revelação termina.
- O painel do navegador desta sessão fica oculto, o que congela `requestAnimationFrame` (medidos `0` quadros em `500ms`). Por isso `behavior: 'smooth'` não avança sozinho e `animationend` não dispara. As medições acima foram feitas forçando quadros por capturas de tela; a limpeza das classes de animação foi exercitada por `animationend` sintético.
- Deploy verificado: o workflow `Deploy Pulse to GitHub Pages` concluiu com sucesso para o merge em `b5c0eb6`. No bundle publicado estão `home-open-entries`, `home-open-entry-card`, `home-open-entry-card-collapse` e `data-staying-count` no CSS, e `Entradas abiertas`, `Ganancia potencial:`, `home-open-entry-card--waiting` e `home-open-entry-card--leaving` no JS. O `homeEntryLight.svg` não vira arquivo próprio porque tem menos de `4KB` e o Vite o embute como data URI; a confirmação de que ele chegou é o identificador `filter0_f_498_13507` do nó original presente no bundle.
- Site publicado conferido no navegador a `375px`, com uma posição semeada: a seção aparece entre o gráfico e `Últimas 10 rondas`, com o card `DOWN` ocupando a largura inteira (`343px` em `375px`, começando em `16`), e a ordem do conteúdo é gráfico, entradas abertas, últimas rondas e rodapé.
- Não validado: gesto real de arraste no controle de deslize e observação do encadeamento em tempo real, em velocidade normal, num navegador visível. Também não foi comparado o comportamento em `499px`.

- Tradução do `MobileOnly` (Claude, nesta máquina, após instalar Node 24): `pnpm lint` sem erros; `pnpm build` concluído (typecheck + Vite); as seis suítes somaram 71 testes aprovados e nenhuma falha (`chart` 13, `fallback` 6, `market` 23, `proxy` 6, `wallet` 15, `entries` 8); `git diff --check` passou.
- Navegador em `500 × 832px`: o aviso cobre a aplicação inteira e exibe `Versión solo móvil`, a descrição em espanhol e `Ancho máximo compatible: 499px`, sem overflow horizontal.
- Navegador em `499 × 832px`: o aviso desaparece e a Home renderiza normalmente com header, gráfico, `Últimas 10 rondas`, UP/DOWN e Navbar.
- Reset de scroll medido a `375 × 812px` após a correção: `history.scrollRestoration` reporta `manual`; saindo da Home em `scrollY = 326` para Movimientos, a amostragem a cada `100ms` durante `1,2s` registrou `326` seguido de `0` estável. Voltar e avançar pelo histórico terminaram em `scrollY = 0`, coerente com a regra já documentada de que a navegação aplica `scrollY = 0`.
- Controle de deslizar após a correção, medido no navegador: com trilho de `307px` o arrasto completo levou o preenchimento a `303px` com folga direita de `2px`; com o viewport em `320px` e trilho de `270px`, a `266px` com a mesma folga de `2px`. A conclusão manteve `folga = 2px` nas fases `--completing` e `--loading`, que é onde o corte aparecia.
- Saída do betslip medida no navegador amostrando o palco a cada `100ms`: durante os `2s` de loading não há `--closing`; em `2239ms` a classe aparece com opacidade `0,95` e `translateY 1,29px`, em `2341ms` `0,64` e `8,73px`, em `2448ms` `0,17` e `19,98px`, e o componente é removido em `2550ms`. Com `prefers-reduced-motion` forçado, `--closing` nunca aparece e a remoção acontece direto em `1936ms`.
- Dobra do ticket medida no toaster renderizado: quadro de `134px`, dobra de `52` a `82`, centro em `67` e desvio do centro igual a `0`. Confirmado também por captura de tela.
- Toaster compacto medido no navegador: altura `140px`, conteúdo `100px`, respiro de `20px` em cima e embaixo, e a dobra do ticket reacompanhou sozinha para `58`, igual ao centro do quadro, sem novo ajuste manual.
- Confetti verificado por gravador de inserção de `<canvas>`, porque o painel do navegador estrangula `setTimeout` e `requestAnimationFrame`. Com `?previewRoundResult=won`, o aviso `Ganaste $149.25` montou em `5157ms` e o canvas entrou `4ms` depois, com `position: fixed` e `zIndex 119`. Captura com os dois na tela confirma partículas roxas entrando de fora do topo, cobrindo a altura inteira, com o aviso legível e sem obstrução.
- Fluxo de venda medido em Entradas: `Vender` abre o betslip em modo venda com `Desliza para vender: 134.12`, sem sair da seção. Após confirmar, o aviso de sucesso e a classe `open-entry-card--leaving` aparecem juntos em `2469ms`, e o card deixa o DOM em `2814ms`. A remoção passa por `onAnimationEnd` filtrado por `open-entry-card-leave`, o que confirma que o keyframe de saída executou.
- Toaster de venda medido pelo fluxo real, com gravador armado só depois do toaster da compra sair: `¡VENTA EN UP!`, `$100.74 Monto recibido`, e as duas linhas `Precio promedio 68¢` e `Participaciones: 148.5`, em `140px` de toaster com `100px` de conteúdo.
- Betslip após o seletor de `32px`: os quatro estados expandidos medidos no navegador voltaram a `2px` de sobra entre conteúdo e palco, que é a folga original — `242/240`, `403/401`, `260/258` e `258/256`.
- Entrada vendida verificada no fluxo real: após comprar e vender tudo, `PASADAS` passou a listar 5 cards em vez dos 4 do seed, com o novo em primeiro lugar exibindo `$159.14`, badge `VENTA`, `Monto: $100`, `Precio de venta 63¢`, `VENTA EN UP`, `Precio objetivo $77,338.46`, sem `Precio final`, sem chevron de resultado e sem divisória; os outros quatro cards seguem exibindo `Precio final`. O betslip em modo venda exibiu `Participaciones`, `Precio de venta` e `Monto a recibir`.
- A suíte passou de 71 para 73 testes aprovados, sem falhas.
- `pnpm lint` voltou a zero avisos. As duas primeiras tentativas de ajustar estado por efeito dispararam `react(set-state-in-effect)` e foram trocadas por ajuste no render.
- Após as mudanças: `pnpm lint` sem erros, `pnpm build` com 123 módulos e novamente 71 testes aprovados sem falhas.

- Após o rebase: `test:fallback` 6, `test:chart` 13, `test:market` 23, `test:proxy` 6, `test:wallet` 15 e `test:entries` 8; total de 71 testes aprovados.
- `pnpm lint`, `pnpm build` com 123 módulos e `git diff --check` passaram sem erros.
- Navegador em `390 × 844px`: na Home, a rodada simulada exibiu `Nueva` e `previous-rounds__card--entering` uma vez e removeu ambos ao final de `860ms`; Movimientos → Home depois do ciclo não repetiu a animação.
- Rodada simulada enquanto Entradas estava ativa: durante o retorno, a animação permaneceu presente nas fases `exiting` e `entering`, continuou visível já na Home e terminou sem repetição; console sem erros ou avisos.

- Histórico v3 validado no navegador em `320 × 568px`, `375 × 832px` e `428 × 832px`: Header em `$2,040.00`, sete movimentos agrupados em quatro datas, modal de ganho em `$200.00`, `ABIERTAS` vazia, duas `GANADAS`, quatro `PASADAS` e Perfil em `$320 / $0 / $360 / +$40`, sem overflow horizontal.
- Persistência validada após F5 com os mesmos sete movimentos e quatro grupos; `?resetWallet=1` removeu o parâmetro da URL. Uma compra real de `$100` em UP reduziu o saldo a `$1,940.00` e criou exatamente um card em `ABIERTAS`, preservando as abas históricas.
- Browser console sem erros ou avisos. A origem Polymarket não resolveu no servidor local (`ENOTFOUND`), mas a contingência silenciosa manteve preços, livro, compra e navegação operacionais.
- `test:wallet`: 15 testes passaram; `test:entries`: 8 testes passaram; oxlint passou; typecheck e build passaram com 122 módulos.

- Sincronização com produção validada após os merges de `origin/main`: Home → Entradas, retorno pelo histórico e rota direta preservaram seção, hash e indicador ativo; uma aba limpa permaneceu sem erros ou avisos no console.
- Retorno `PASADAS` → scroll → Home validado: a origem estava em `scrollY=222`; a Home entrou em `scrollY=0` diretamente com `SubHeader` em `64px` e `PriceComparison` em `90px`, sem classes compactas nem erros no console.
- Suíte integrada após produção: `test:chart` 13, `test:fallback` 6, `test:market` 23, `test:wallet` 14 e `test:entries` 7; lint, build com 121 módulos e `git diff --check` passaram.

- `GANADAS` validada no navegador em `320 × 568px`, `375 × 832px` e `428 × 832px`; depois, chips e cards foram padronizados com o padding lateral de `16px` usado pela Home.
- `PASADAS` validada no navegador com os três estados em `320px`, `375px` e `428px`: cards com `196px`, badges/cores correspondentes, chips estáveis e console limpo. A margem lateral final é de `16px`.
- Chips de Entradas alterados para `position: sticky` no topo com o mesmo comportamento da Home: transparentes enquanto estão no fluxo e com uma cópia alinhada de `bgHeader.png` somente no estado pinned, sem faixa própria ou blur. Em `375 × 568px`, permaneceram em `top: 0` após `232px` de rolagem, sem overflow horizontal.
- A faixa sticky dos chips usa `8px` de padding vertical e `16px` nas laterais; o indicador ativo acompanha a nova origem vertical e o estado vazio desconta a altura final de `48px`.
- Reserva inferior de Entradas separada do inset de `130px` da Home e ajustada à Navbar fixa mais a área segura. No fim de `PASADAS`, o último card terminou `10px` acima da Navbar, sem o espaço excedente anterior.
- Transição dos chips validada no navegador: indicador percorreu de `translateX(0)` a `206px` e ajustou a largura de `104px` para `82px`; o conteúdo passou por opacidade intermediária antes de estabilizar, sem overflow. Em `320px`, os chips encerram em `x=300px` dentro do viewport.
- O card vencedor foi exercitado com dados reais persistidos da carteira: payout, badge, monto, preço médio, data, janela, lado, participações, preços objetivo/final e indicador direcional renderizados.
- `pnpm test:wallet`: 13 testes passaram; `pnpm test:entries`: 6 testes passaram; `pnpm lint`, `pnpm build` e `git diff --check` passaram.

- Publicação estática validada com `VITE_BASE_PATH=/pulse/`: 86 módulos transformados, assets emitidos sob `/pulse/assets/` e aplicação carregada em `http://127.0.0.1:4175/pulse/` com título, fontes, imagens, preço ao vivo, gráfico e dez rodadas; nenhum asset local ficou quebrado.
- Build alternativo com `VITE_POLYMARKET_PROXY_ORIGIN` configurado também passou e incorporou a origem pública no bundle.
- `pnpm test:proxy`: 5 testes passaram; o bundle do Worker também passou em `wrangler deploy --dry-run` com 2,85 KiB, sem bindings ou segredos.
- Suíte desta tarefa: `pnpm test:chart` (13), `pnpm test:fallback` (6), `pnpm test:market` (23), `pnpm test:proxy` (5), `pnpm test:wallet` (11), `pnpm lint`, `pnpm build`, validação YAML e `git diff --check` passaram.
- Links do footer validados no navegador a `428px`: `Términos y condiciones`, `Aviso de privacidad`, `Preguntas frecuentes` e `Soporte` renderizaram em quatro linhas de `21px`, com largura interna de `362px` e sem overflow horizontal.
- Cadência da seta validada no navegador a `428px` durante `9s`: a direção permaneceu DOWN apesar das atualizações do preço, os ciclos visíveis duraram aproximadamente `740ms`, os reinícios ficaram entre `867ms` e `900ms` e as pausas entre ciclos ficaram entre `108ms` e `150ms`. O contêiner não possui transição adicional, o gráfico preservou `428px` e não houve overflow horizontal.
- Troca direta dos níveis validada no navegador a `428px`: os sete grupos e seus nós de texto preservaram a mesma identidade enquanto os valores passaram de `$78.340–$78.220` para `$78.380–$78.260`; grupos, textos, linha e área permaneceram com `opacity: 1` e `animation: none`. O gráfico ocupou os mesmos `428px` do viewport sem overflow horizontal.
- Estabilidade observada no navegador: após a primeira atualização já em curso, três mudanças consecutivas do grupo visual ocorreram com intervalos de `1.227ms` e `1.000ms`, sem animação ou anúncio acessível automático.
- Compra livre validada: o saldo simulado foi descontado no início da confirmação, o app recebeu `aria-busy`/`inert` durante o loading e a cotação aceita permaneceu congelada.
- `Un toque` validado: toque em `$10` atualizou o saldo imediatamente e, após `2s`, exibiu `Ganancia potencial`, participações e `Precio promedio` efetivos no toaster.
- Venda validada em dois passos: uma piora real acima de `1¢` exibiu `El precio cambió. Revisa la nueva cotización.` sem alterar o saldo; a nova tentativa aceita creditou o saldo no início e exibiu `Monto recibido` e preço médio efetivos.
- Recotação determinística validada com `?testQuoteReprice=buy`: piora forçada de `2¢`, saldo inalterado, ausência de loading e nova cotação apresentada.
- Falha do CLOB validada com `?testDataFailure=clob`: origem `local`, status `live`, nenhuma mensagem de fallback e operação habilitada.
- Uma origem limpa em `127.0.0.1:5176` confirmou a entrada silenciosa do fallback após `3s`, mas não permitiu validar o CLOB real: o host retornou `ENOTFOUND` para `polymarket.com` e o navegador não resolveu `gamma-api.polymarket.com`. A aplicação permaneceu operacional e sem erros no console.
- Responsividade validada em `320px`, `375px` e `499px`: betslip sem overflow horizontal e scroll até o footer; em `375px`, o padding inferior dinâmico ficou em `324px` e o footer terminou exatamente no topo do betslip.
- Ajuste de nomenclatura validado novamente a `375 × 812px`: compra, venda e `Un toque` exibem `Precio promedio`, `Ganancia potencial` e `Monto a recibir`, sem a linha permanente de proteção; o feedback condicional de recotação/indisponibilidade continua preservado.
- Ritmo vertical do betslip de monto livre comparado com a captura exata da primeira versão a aproximadamente `430 × 868px`: o estágio atual ficou com `251px` contra cerca de `249px` da referência, o intervalo entre o handle e o cabeçalho ficou em aproximadamente `17px` contra `16,5px`, e divisor, métricas e controle de deslize permaneceram alinhados dentro da variação de poucos pixels esperada da captura.
- A mesma composição foi validada em `320px`, `375px` e `499px`: `Monto`, `Precio promedio` e `Ganancia potencial` permanecem completos, centralizados e em uma linha, sem overflow horizontal. Nenhum cálculo, estado ou interação do betslip foi alterado nesse ajuste.
- No resumo recolhido de compra, o rótulo do retorno foi encurtado para `Ganancia`; `Ganancia potencial` permanece no betslip expandido e no toaster, e o resumo de venda continua usando `Recibe`. O estado foi comparado com a referência em `428 × 832px`: o novo rótulo ficou em uma única linha, sem alterar dimensões, valores ou alinhamento, e um carregamento limpo não apresentou erros ou avisos no console.
- A edição de `Monto` agora preserva o valor anterior antes de limpar o campo. O fluxo foi validado no navegador partindo de `$100`: abrir e pressionar `Hecho` vazio restaurou `$100`; abrir novamente, digitar `25` e pressionar `Hecho` manteve `$25`. O protótipo foi devolvido a `$100` ao final.
- `pnpm test:market`: 23 testes passaram; `pnpm test:wallet`: 11; `pnpm test:fallback`: 6. Oxlint e build de produção passaram.

- Monitoramento acumulado de `180s`: série cresceu até 120 pontos e permaneceu no limite; em todas as amostras com continuidade, o início do path ficou em `x=0`, sem queda de contagem dentro da rodada.
- Virada real validada de `10:45–11:00` para `11:00–11:15`: `seriesKey` mudou uma única vez, `resetReason` passou para `round-change`, `seriesStart` coincidiu exatamente com o novo `roundStart` e o gráfico não exibiu estado vazio.
- Domínio validado em alta frequência: mudanças produziram valores intermediários de bottom/top; após a confirmação de tendência de `750ms`, uma amostra de `8s` permaneceu em um único domínio estável.
- Contingência validada sem estado vazio: falha de Chainlink selecionou Coinbase; falha conjunta de Chainlink e Coinbase selecionou Kraken, ambos com status `live` e pontos ativos.
- Responsividade preservada nas verificações de `375px` e `499px`: altura de `256px`, linha ancorada em `x=0` e sem overflow horizontal.
- `pnpm test:chart`: 9 testes passaram; mercado: 23; contingência: 6; carteira: 11. Oxlint, TypeScript, build de produção e `git diff --check` passaram; uma aba limpa carregou sem erros ou avisos no console.

- Atualização das últimas 10 rodadas: `pnpm test:market` passou com 12 testes; lint, TypeScript e build de produção passaram.
- Navegador validado na rodada atual `10:30–10:45`: os 10 cards ficaram consecutivos de `10:15–10:30` até `08:00–08:15`, todos em `01/09`, sem salto para o histórico de `31/08`.

- Oxlint: passou sem erros.
- TypeScript e build de produção: `pnpm build` passou com 82 módulos transformados.
- `git diff --check`: passou.
- `pnpm test:fallback`: 6 testes passaram.
- `pnpm test:market`: 10 testes passaram.
- `pnpm test:wallet`: 11 testes passaram.
- Contingência total validada em `428 × 832px` com `?testDataFailure=all-polymarket`: Coinbase manteve o preço e o gráfico, alvo/cache ficaram ativos, odds locais publicaram cinco asks e cinco bids por lado, UP/DOWN e betslip permaneceram habilitados e nenhum texto de contingência apareceu.
- Fallback de preço validado separadamente: falha de Chainlink selecionou Coinbase; falha conjunta de Chainlink e Coinbase selecionou Kraken; todos os estados permaneceram `live`.
- Falha do CLOB validada com Chainlink ativo: odds complementares locais continuaram atualizando, o betslip abriu com cotação, teclado e confirmação disponíveis, e o bloqueio local permaneceu após F5 e após restaurar a URL no meio da mesma rodada.
- Rolagem mobile validada até o footer sem overflow horizontal; nova aba de cada cenário carregou sem erros ou avisos no console.
- Uma virada real ocorreu durante a validação: a rodada encerrada entrou no histórico local, a posição pendente foi liquidada uma única vez e a rodada nova manteve alvo, saldo e série.
- JSON dos tokens validado com `jq empty`.
- Preview local iniciado em `http://127.0.0.1:5175/`.
- Estrutura do header: `375 × 56px`, padding horizontal ajustado para `16px`, padding vertical `4px`, gap `8px` e ações `32/36px`.
- A pilha de mercado agora possui dois limiares: fixa no topo em `56px`, ainda com alturas normais, e inicia a compactação conjunta somente em `80px`.
- Fixação suave validada a `375px` com `position: sticky`: durante a aproximação, o topo percorreu `4px` em `scrollY=52`, `2px` em `54`, `0px` em `56` e permaneceu em `0px` após `58`, sem troca de posicionamento nem salto. Em `scrollY=85`, a pilha compactou para `40px/55px`; ao retornar para `70`, expandiu para `64px/90px` ainda fixa no topo e sem overflow horizontal.
- Scroll rápido validado a `375px` com salto imediato de `scrollY=0` para `342`: antes do React aplicar a classe compacta, a pilha já estava fixa em `top=0`, com o pseudo-fundo em opacidade `1`, asset carregado e o próprio market header cobrindo o ponto testado; após a animação estabilizou em `95px`, sem overflow horizontal nem frame transparente para o gráfico.
- Separação validada no navegador a `375px`: em `scrollY=60`, a pilha estava fixa no topo com alturas `64px/90px`; em `scrollY=85`, estava compacta em `40px/55px`; ao retornar para `scrollY=70`, expandiu mantendo-se fixa. Console sem erros ou avisos.
- PriceComparison validado a `375px`: estado normal em `y=120`, `90px` de altura; estado fixo em `top=40px`, `55px` de altura, cards de `47px` e valores de `16px`.
- Stroke interno de `PriceComparison` validado a `375px`: os dois cards mantiveram `74px` de altura e `167,5px` de largura, borda estrutural transparente e camada interna de `1px` em `rgba(251, 251, 251, 0.12)`; no estado compacto, preservaram `47px` de altura e não criaram overflow.
- SubHeader e PriceComparison recebem o mesmo estado compacto controlado pelo `App`, garantindo início e reversão simultâneos em `80px` de scroll; a pilha já está fixa desde `56px` e mantém as bordas dos componentes encostadas durante toda a animação.
- PreviousRounds validado a `375px`: título `Últimas 10 rondas` com linha de `24px`, card responsivo de `335 × 96px`, padding inicial `16px`, área livre à direita de `24px`, gap entre cards de `8px` e cinco bullets dinâmicos.
- Navegação validada com scroll horizontal responsivo de `343px` em `375px`: segundo card ativo e bullets alterados de `6/4/2/2/2px` para `4/6/4/2/2px`.
- Largura responsiva validada em `375px` e `499px`: o card usa `100vw - 40px` e mantém exatamente `24px` livres à direita; console sem erros ou avisos.
- Chevrons de resultado UP/DOWN ajustados para `stroke: var(--Fill-Colors-fillDark, #000)` e validados no navegador com assets `24 × 24px` carregados.
- Brilho dos cards de PreviousRounds esticado com o asset original e validado em `375px`: largura `287px` dentro do card de `335px`, deixando exatamente `24px` em cada lateral.
- PulseFooter validado em `375px`: padding superior `40px`, margens laterais `16px`, card com `328px` de altura, padding interno `16px`, gap `20px` e descrição em quatro linhas.
- Responsividade do footer validada em `320px` e `499px`: cards de `288px` e `467px`, respectivamente, sem overflow horizontal; descrição cresce e reduz naturalmente conforme a largura. Console sem erros ou avisos.
- Navbar validada em `375px`: altura `58px`, margem lateral `16px`, distância inferior `8px`, três itens de `46px` e Home ativo.
- Navbar permaneceu fixa com `scrollY=600`; responsividade validada em `320px` e `499px`, com larguras de `288px` e `467px`, sem overflow ou truncamento dos labels. Console sem erros ou avisos.
- Fade inferior da Navbar validado a `375px`: pseudo-elemento de `98px`, gradiente preto de `100%` para transparente, cobrindo até a borda inferior da viewport e permanecendo fixo durante o scroll. Console sem erros ou avisos.
- MarketChoice validado em `375px`: altura `40px`, margem lateral `16px`, gap interno `8px`, botões iguais e distância exata de `8px` para a navbar.
- MarketChoice permaneceu fixo com `scrollY=600`; responsividade validada em `320px` e `499px`, com botões de `140px` e `229.5px`, sem overflow horizontal ou de conteúdo. Console sem erros ou avisos.
- Fechamento acelerado validado a `375px`: `Cerrando ronda…` usa `Background/backgroundPrimGradStart` (`#191919`) e borda `0`; ao chegar em `00:00`, o card grande de resultado não existe mais.
- Toast vencedor validado a `375px` em `?previewRoundResult=won`: `Ganaste $149.25`, topo em `12px`, altura de `45px`, ícone `16 × 16px`, fundo `#04110C`, borda `#34D399`, raio `56px` e saída concluída após `4s + 300ms`. Nenhum erro de página foi registrado.
- Entrada da nova rodada validada a `430px` em `?previewRoundResult=won&demo=toast`: aos `00:00`, o snapshot entrou imediatamente na primeira posição, a lista permaneceu limitada a 10 cards e o trilho ficou em `scrollLeft=0`. A animação iniciou em `translateX(-40px) scale(0.98)`, opacidade `0,16` e recorte horizontal completo; no ápice, o card estava quase totalmente revelado, com badge `Nueva`, borda verde a 72%, brilho interno a 20% e sweep ativo; após o ciclo, badge e sweep ficaram invisíveis, a borda retornou a 12%, o transform ficou neutro e a mensagem acessível permaneceu `Nueva ronda añadida. Resultado: arriba.`. Console sem erros.
- BuyBetslip expandido validado em `375px`: card responsivo com `16px` laterais, `242px` de altura e distância de `8px` para a Navbar; UP e DOWN abrem com cor, preço médio e ganho correspondentes.
- Teclado do nó `244:3941` validado com `160px` e quatro linhas de `40px`; ao abrir, o card chega a `403px`. Entrada `25`, exclusão, `Hecho` e recálculo para `$37,31` foram exercitados no navegador.
- Estado recolhido do nó `244:4222` validado com `56px`, distância de `8px` para a Navbar e reabertura por toque. A confirmação acessível por teclado exercitou o mesmo caminho final do swipe.
- Responsividade validada em `320px` e `499px`, com larguras de `288px` e `467px`, sem overflow. O bloqueio `MobileOnly` permanece ativo a partir de `500px`.
- Console do navegador sem erros ou avisos de aplicação.
- PriceChart validado a `375px`: posição logo após a pilha de mercado, largura `375px`, altura `256px`, seguido imediatamente por `PreviousRounds` e sem overflow horizontal.
- Atualização dinâmica validada no navegador: o valor visível mudou de `$80,208.472` para `$80,208.714` após um novo ponto simulado.
- Responsividade do PriceChart validada a `499px`: largura `499px`, altura preservada em `256px`, bloqueio mobile oculto e console sem erros ou avisos.
- Sincronização mais recente do PriceChart validada a `375px`: fundo computado transparente, indicador com opacidade `1`, dimensões `375 × 256px`, sem overflow e sem erros no console.
- Correção visual do gráfico validada a `375px`: a linha e a área usam máscara lateral para transparência, o overlay preto anterior não existe mais, o indicador possui somente dois paths sem retângulo de fundo e a animação dos chevrons permanece ativa. Console sem erros ou avisos.
- Fade lateral refinado e validado a `375px`: largura `96px`, 11 níveis de opacidade seguindo uma curva suave, sem overlay legado, sem overflow e sem linha vertical perceptível no preenchimento. Console sem erros ou avisos.
- Zona limpa revisada e validada a `375px`: as três máscaras usam um recorte quadrado preto de `30 × 30px`, sem círculos; o glyph contém apenas os dois chevrons, sem outline ou borda, e o gráfico permanece com `375 × 256px` e sem overflow horizontal.
- Fade sequencial dos chevrons validado a `375px`: quatro atualizações consecutivas atingiram opacidade entre `0,85` e `1`; uma sequência UP passou de `0` para `0,98` e recebeu a atualização seguinte após `784ms`, enquanto DOWN atingiu `0,87` e terminou com `data-direction-visible=false`. O segundo chevron inicia `120ms` depois do primeiro e o ciclo reinicia por sequência.
- Dados reais validados a `375px`: rodada `btc-updown-15m-1788202800`, preço objetivo `$79,000.54`, preço atual `$79,159.23`, ambos com status `live`; o valor atual mudou para `$79,167.94` sem recarregar.
- Timer real validado no navegador: passou de `06:05` para `05:51`; a exibição fixa em `America/New_York` usada naquele teste foi posteriormente substituída pelo fuso local do dispositivo.
- Série real do gráfico validada: cresceu de 25 para 39 pontos, atualizou o valor visível e manteve largura de `375px` sem overflow.
- Reconexão forçada validada em modo de desenvolvimento: status passou por `reconnecting` e voltou a `live` após o próximo pacote Chainlink, preservando e retomando a série.
- Proxy local validado para a rodada atual: retornou `openPrice: 79000.54393019216`, o mesmo valor bruto renderizado em `Precio objetivo`.
- Responsividade dos dados reais validada em `499px`: bloqueio mobile permaneceu oculto, largura do documento e gráfico em `499px`, feed `live` e 18 pontos recebidos, sem overflow horizontal.
- Indicador de movimento validado a `375px`: a sequência visual permanece ativa até o fim de seu próprio ciclo, independentemente do término do preço; o recorte quadrado de `30px` continua permanente e impede que linha, área e tracejados reapareçam atrás do espaço da seta.
- Sincronização do preço atual validada a `375px` durante uma atualização real: 10 frames consecutivos da transição compartilhada apresentaram igualdade exata entre os valores numéricos e formatados do card e da etiqueta do gráfico; a seta agora usa ciclo independente.
- Tooltip do gráfico validado a `375px`: nenhum elemento SVG `title` nem atributo HTML `title` permanece no componente; o SVG conserva `aria-label="Precio en tiempo real"` e uma descrição acessível.
- Entradas simuladas do gráfico validadas a `375px`: UP apareceu como `+$40` em `rgb(52, 211, 153)` e percorreu 28 amostras de `y=170,84` até `y=58,47`; DOWN apareceu em `rgb(248, 113, 113)` e subiu de `y=167,65` para `y=121,14` nas 12 amostras observadas. O feed BTC permaneceu `live`, com 30 pontos reais e sem overflow horizontal.
- Atualização após a virada corrigida e validada a `375px`: preço atual e gráfico apareceram como `live` no primeiro pacote recebido, com idade de `418ms`; após `2,2s`, o valor mudou novamente, o gráfico passou de 1 para 2 pontos e a idade do último recebimento permaneceu em `653ms`.
- `PreviousRounds` real validado a `375px`: status `live`, 10 cards renderizados e largura total rolável de `3454px`, mantendo `375px` de viewport sem overflow da página. A primeira rodada `15:15 - 15:30` exibiu `$79,173.74` → `$79,079.86`, resultado DOWN; a décima `13:00 - 13:15` exibiu `$78,620.60` → `$78,719.56`, resultado UP.
- Responsividade das 10 rodadas reais validada em `499px`: card de `459px`, exatamente `24px` livres à direita e nenhum overflow horizontal da página.
- Stroke interno de `PreviousRounds` validado a `375px` e `499px`: card preservou `335px`/`459px` de largura, `96px` de altura, `24px` livres à direita e camada interna em `rgba(251, 251, 251, 0.12)`, sem overflow horizontal.
- Os valores brutos da primeira rodada foram comparados diretamente com a resposta da fonte: `openPrice: 79173.74234981783`, `closePrice: 79079.85742148713` e `completed: true`.
- Densidade do gráfico validada a `375px`: 7 linhas e 7 rótulos horizontais em `256px`, com referências-base em intervalos de `$2,50` e faixa total de `$15`; o rótulo alinhado ao marcador atual permanece no SVG atrás da etiqueta. O eixo temporal apresentou diferenças exatas de `5.000ms` entre as marcações. Gráfico, documento e viewport conservaram `375px`, sem overflow horizontal.
- Persistência dos rótulos validada com o feed real a `375px`: os 7 números permaneceram presentes; o nível `$78,810.00`, a apenas `8,64px` do marcador atual, continuou renderizado atrás da etiqueta, enquanto gráfico, documento e viewport mantiveram `375px` sem overflow.
- Reenquadramento por tendência validado com o feed real a `375px`: durante uma alta curta, o domínio passou de `$78.890–$78.920` para `$78.900–$78.930`, deslocando exatamente dois intervalos de `$5` para cima. A grade permaneceu com 7 níveis, gráfico e documento conservaram `375px` e não houve overflow horizontal; a queda usa a mesma regra simétrica para baixo.
- Entrada dos novos níveis validada com o feed real a `375px`: durante uma atualização do domínio em `$2,50`, os dois níveis acrescentados (`$78,835.00` e `$78,832.50`) iniciaram com `opacity: 0` na animação de `280ms`, enquanto os cinco níveis reaproveitados permaneceram em `opacity: 1` e apenas receberam a transição de posição. A grade conservou 7 rótulos e `375px` de largura sem overflow.
- Fuso local validado a `375px`: o navegador identificou `America/Sao_Paulo`; SubHeader exibiu `16:30 - 16:45`, a rodada anterior `16:15 - 16:30` e o eixo do gráfico `16:42:08`, todos no mesmo fuso, sem alterar o ciclo UTC real das rodadas.
- Mercado UP/DOWN real validado no navegador: o slug `btc-updown-15m-1788216300` publicou UP `12,5%` e DOWN `87,5%`, com 87/12 níveis de asks e 12/87 níveis de bids; os valores continuaram mudando pelo WebSocket sem recarregar.
- VWAP validado nos fluxos: `$100` em UP consumiu múltiplos níveis e exibiu preço médio/participações dinâmicos; os três valores de `Un toque` produziram resultados diferentes pela própria profundidade; venda recalculou `Precio promedio` e `Monto a recibir` pelos bids.
- Loading e congelamento exercitados em `Un toque`: todos os controles ficaram bloqueados e o toast reutilizou exatamente as participações e o preço médio da cotação capturada antes dos dois segundos.
- Liquidez insuficiente exercitada com `$99.999`: `Precio promedio` e `Ganancia` passaram para `—`, o texto mudou para `Cotización no disponible` e o swipe ficou desabilitado.
- Virada real observada: próximo do fechamento o livro sem cotação válida mostrou `—`; na troca, o slug passou para `btc-updown-15m-1788217200` e somente depois de novos snapshots voltou a `live`, sem reutilizar os preços anteriores.
- Betslip real validado em `320px`, `375px` e `499px`: largura acompanhou exatamente o viewport, documento sem overflow horizontal e operação disponível apenas com cotação completa.
- Venda zerada validada na rodada `btc-updown-15m-1788218100`: UP e DOWN começaram com `0 participaciones`, `Precio promedio` e `Monto a recibir` ficaram em `—`, e o swipe exibiu `No tienes participaciones para vender` desabilitado.
- Entrada da compra em venda validada no navegador: uma compra de `$10` em UP resultou em `19,21` participações disponíveis somente em UP, manteve DOWN em `0` e liberou o swipe de venda com preço médio de `$51¢` e recebimento estimado de `$9,80` pelos bids daquele snapshot.
- Confirmação de venda validada com arraste real: durante `Preparando tu venta`, o swipe ficou em loading, a aplicação recebeu `inert` e o betslip permaneceu expandido. Após `2s`, o betslip foi desmontado e o toaster exibiu `¡VENTA EN UP!`, `$9,80 Monto recibido`, `19,61` participações vendidas e preço médio de `50¢` do snapshot congelado.
- Baixa da posição validada após o toaster: ao reabrir `Vender`, UP e DOWN estavam em `0`, o betslip continuou expandido e o swipe voltou a `No tienes participaciones para vender`, desabilitado.
- Carteira validada no navegador a `430 × 832px`: `?resetWallet=1` restaurou `$2,000.00`, removeu o parâmetro da URL e o header expôs `200000` centavos.
- Compra de `$100` em UP descontou o saldo para `$1,900.00`, exibiu o toast com a cotação congelada e restaurou saldo e `116,18` participações após F5.
- Venda total das `116,18` participações creditou o `grossValue` de `$16.18`, atualizando o saldo para `$1,916.18` e o toast para `Monto recibido`.
- Saldo insuficiente validado com `$99,999`: o controle exibiu `Saldo insuficiente` e permaneceu desabilitado, sem alterar a carteira.
- Vitória demonstrativa validada: após `00:05`, o saldo passou de `$2,000.00` para `$2,149.25`; um novo F5 repetiu o toast, mas manteve `$2,149.25`, comprovando crédito único por rodada.
- Sincronização entre abas validada: reset atualizou ambas para `$2,000.00` e uma compra subsequente atualizou ambas para `$1,900.00`. O protótipo foi restaurado ao saldo inicial ao fim da validação.
- Nova aba limpa carregou sem erros ou avisos no console.
- Indicador de entrada ativa validado a `430 × 832px`: começou ausente, apareceu após compra de `$100` em UP, usou `8 × 8px`, `rgb(248, 113, 113)` e animação `navbar-live-pulse` de `1,6s`, permaneceu após F5 e desapareceu após a venda total. O estado de teste foi limpo para `$2,000.00` e uma nova aba carregou sem erros ou avisos.

- Pull Request, merge e deploy: `chore/misc-updates` foi ao PR #19 em sete commits temáticos e mesclada; `chore/update-workflow-actions` ao PR #20; `fix/keyboard-swipe-clipping` ao PR #21. As três branches remotas foram removidas no merge.
- Deploys concluídos com sucesso em sequência: `33572918727` para o PR #19, `33573528711` para o #20 e `33573618725` para o #21. O #20 foi mesclado antes do #21 de propósito, para que o próprio deploy validasse as actions novas antes de a correção seguinte subir. Os avisos de depreciação do Node 20 caíram de dois para zero.
- Produção conferida em `https://design-draftea.github.io/pulse/`: resposta `200`, e o CSS servido contém a regra `buy-betslip--keyboard .buy-betslip__expanded{padding-top:...}`, confirmando que o build publicado é o corrigido.

## Pendências e riscos

- O swipe real de compra foi exercitado por arraste contínuo nesta tarefa; nenhuma pendência funcional foi encontrada no escopo do histórico inicial.
- Falta comparar capturas do bloqueio completo nos viewports de `499px` e `500px`; até isso acontecer, `design-qa.md` permanece bloqueado.
- O Worker do proxy está publicado e a variável `PULSE_POLYMARKET_PROXY_ORIGIN` está configurada no repositório, apontando para `pulse-polymarket-proxy.pulse-design-draftea.workers.dev`. Consultado em `2026-09-02`, `/health` respondeu `200` e a rota real de preço devolveu `openPrice`, `closePrice` e `completed: true` de uma janela encerrada, em `0,42s`. Ou seja, a produção usa o alvo oficial da Polymarket, e não a contingência. Esta pendência está encerrada.
- Neste computador não há sessão Cloudflare, então republicar o Worker daqui exigiria autenticar antes; o Worker em uso já está no ar e não depende disso. O GitHub CLI está autenticado como `design-draftea` com escopos `gist`, `read:org` e `repo`, e o acesso Git por SSH permanece válido.
- Compra, venda e saldo continuam simulados e persistem somente no navegador; taxas taker não entram no VWAP. Durante falha da Polymarket, preços UP/DOWN e profundidade também são sintéticos e existem apenas para continuidade do protótipo.
- Repetir a observação dos snapshots reais do CLOB quando o ambiente voltar a resolver `polymarket.com` e `gamma-api.polymarket.com`; nesta sessão somente o caminho resiliente local pôde ser exercitado de ponta a ponta.
- `fix/last-round-seen-animation` já foi publicada e mesclada pelo PR #18; a `main` local e a `origin/main` estão em `536e538`. Essa pendência está encerrada.
- A máquina não tinha Node instalado. Foi instalado `node@24` (24.20.0) via Homebrew e ativado `pnpm@11.19.0` por corepack; como a fórmula é keg-only, `export PATH="/opt/homebrew/opt/node@24/bin:$PATH"` foi acrescentado ao `~/.zshrc` (backup em `~/.zshrc.bak-pre-node24`). Terminais já abertos precisam ser recarregados.
- `.claude/launch.json` configura o servidor de desenvolvimento e aponta para o caminho absoluto do pnpm, porque o preview não herda o `PATH` do perfil. Por ser específico da máquina, `.claude/` passou a constar no `.gitignore`.
- O betslip não pôde ser exercitado por gesto real de toque no fim da sessão porque o mercado ficou indisponível no ambiente (`Precio actual —`, UP/DOWN em `50%`); a verificação do preenchimento foi feita por eventos de ponteiro sintéticos e por medição direta da geometria.
- Dívida conhecida: o `key` de `SwipeToBuy` ainda inclui `isKeyboardOpen`, então abrir ou fechar o teclado continua recriando o componente. É intencional, porque o layout muda, mas vale reavaliar se algum dia o estado do gesto precisar sobreviver a essa troca.
- A correção de scroll foi confirmada pela pessoa usuária no Chrome do iPhone, que é onde o defeito aparecia e que o ambiente local não reproduz. O confetti também foi confirmado em aparelho real, sem engasgo na virada de rodada. Ambas as pendências estão encerradas.
- No ambiente local, `polymarket.com` responde `502` e `gamma-api.polymarket.com` não resolve; Chainlink RTDS também não conecta. A contingência silenciosa cobriu preços, livro e histórico, então os erros de console observados são de rede e não têm relação com estas mudanças. A limitação é desta rede, e não da fonte: o mesmo caminho consultado pelo Worker na Cloudflare devolve dados reais da Polymarket. Vale lembrar disso antes de atribuir à Polymarket qualquer sintoma observado apenas em desenvolvimento.

## Próximo passo

- Nenhum trabalho em andamento. Os PRs #45 e #46 estão mesclados e publicados. A branch `feature/ajuda-hf` continua no remoto e pode ser removida.
- Confirmar com quem desenhou se a borda mais fraca do primeiro card no nó `457:8806` é intenção ou deslize.
- Ver a navegação deslizante num aparelho real. Aqui ela foi medida por estilo computado no meio do trajeto, o que prova o percurso mas não o quanto ele parece fluido ao dedo.
- Vale olhar as setas coloridas num aparelho real, em movimento de preço, para confirmar que o verde e o vermelho leem bem sobre o fundo do gráfico nos `620ms` em que aparecem.
- Vale ver o encadeamento das entradas abertas rodando em tempo real num aparelho: toaster, scroll de centralização, revelação do card, fade do título e a saída em que a entrada que fica assume a posição. Na sessão do PR #41 ele só pôde ser percorrido forçando quadros, porque o painel do navegador mantém `requestAnimationFrame` congelado.
- O passo `Test` do workflow não executa `pnpm test:assets`, que existe desde a tarefa anterior. As outras seis suítes estão lá. Vale incluir na próxima vez que o workflow for tocado.
- Itens antigos, para quando houver prioridade: comparar as capturas de `499px` e `500px` que mantêm `design-qa.md` bloqueado; e subir `actions/checkout`, `actions/setup-node` e `cloudflare/wrangler-action`, que têm major mais novo mas não estavam no aviso de depreciação.
