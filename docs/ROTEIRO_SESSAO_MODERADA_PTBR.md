# Roteiro da sessão moderada — Draftea Pulse

Documento para revisão interna em português do Brasil. Descreve uma sessão
moderada que combina **teste de usabilidade** e **entrevista em profundidade**,
usando o mesmo protótipo do estudo não moderado no Maze.

O questionário não moderado está em [MAZE_STUDY_PLAN_PTBR.md](MAZE_STUDY_PLAN_PTBR.md).
Este roteiro não o substitui: os dois medem coisas diferentes e se completam.

## O que muda em relação ao estudo no Maze

O estudo no Maze mede **o que acontece**: quantos concluem, onde hesitam, o que
entendem depois de usar. A sessão moderada mede **por quê**: qual modelo mental a
pessoa traz, que vocabulário usa, o que ela espera antes de tocar na tela e o que
a faria — ou não — colocar dinheiro real ali.

Por isso as tarefas permanecem as mesmas — com uma exceção deliberada na tarefa
1 —, e quase todas as perguntas mudam de forma.

| | Maze (não moderado) | Sessão moderada |
|---|---|---|
| Tarefas 2 a 4 | iguais | **iguais** |
| Tarefa 1 | introdução abre sozinha pelo link | **descoberta livre**, com a intenção perguntada antes |
| Pergunta aberta "como funciona uma rodada" | saiu do Maze | **fica**, é a âncora da entrevista |
| Múltipla escolha de compreensão | mede acerto | vira **pergunta aberta com sonda** |
| Escalas 1–5 | dado quantitativo | **uma por tarefa**, só para puxar o "por quê" |
| Matriz final de concordância | 5 afirmações | **sai**; vira "explique o produto para mim" |
| Perguntas iniciais de perfil | no começo do teste | **vão para o recrutamento** |
| Primeira impressão sem tarefa | não existe | **entra** |
| Assistir ao fim de uma rodada | impossível | **entra** |
| Contexto de vida financeira | não existe | **entra**, é o que dá profundidade |

**Por que manter as mesmas tarefas.** Elas cobrem o ciclo do produto — entender,
comprar, vender, acompanhar — e permitem cruzar o que a sessão explica com o que
os números do Maze mostram. Uma taxa alta de erro na pergunta de `Ganancia
potencial` no Maze ganha explicação quando três pessoas na sessão leem o rótulo
em voz alta e hesitam no mesmo ponto.

**Por que tirar a múltipla escolha.** Numa sessão moderada, a alternativa ensina
a resposta. Perguntar "o que esse valor representa?" e ficar em silêncio rende
mais do que quatro opções, e ainda revela a palavra que a pessoa usa.

**Por que tirar a matriz final.** Cinco afirmações em escala com seis
participantes não produzem número utilizável. O mesmo tempo, gasto pedindo que a
pessoa explique o produto para um amigo imaginário, mede compreensão melhor.

**Por que a tarefa 1 é a única que diverge.** No Maze, o link inicial passou a
abrir a introdução automaticamente (`?task=onboarding`) e a pergunta aberta sobre
como funciona uma rodada saiu. Faz sentido lá: sem moderador, não dá para saber
por que alguém não achou o ícone `?`, e texto livre rende pouco.

Na sessão moderada a decisão se inverte, porque as duas limitações desaparecem:

- **a descoberta é observável.** Ver a pessoa procurar — e falhar — é o achado
  mais barato da sessão. Abrir a introdução pelo link jogaria fora exatamente o
  que só a moderação permite ver.
- **a pergunta aberta rende.** Com moderador e sonda, "como funciona uma rodada"
  é a pergunta que mais rende da sessão inteira.

O custo é que a tarefa 1 deixa de ser comparável com a do Maze. É um custo
aceitável: as tarefas 2, 3 e 4 continuam idênticas e sustentam o cruzamento, e a
tarefa 1 moderada mede algo que o Maze deixou de medir em vez de repetir o que
ele já mede.

## Formato

Estas condições são premissas deste roteiro; ajuste antes de rodar.

- **Duração:** 60 minutos.
- **Modalidade:** remota, com compartilhamento de tela do celular.
- **Aparelho:** o próprio celular do participante. O protótipo é mobile.
- **Participantes:** de 5 a 8, o suficiente para saturar os padrões de confusão.
- **Não repetir pessoas** que já responderam ao estudo no Maze: elas chegariam
  treinadas e a primeira impressão estaria perdida.
- **Gravação:** com consentimento explícito no início, registrado na gravação.

## Perfil e recrutamento

O estudo no Maze não define perfil — quem recebe o link responde. Aqui o perfil
é a variável mais cara da sessão, então precisa ser decidido antes.

Sugestão de composição, a confirmar com quem conduz a pesquisa:

- Todos usuários ativos da Draftea, para que o produto chegue no contexto real.
- Maioria **sem familiaridade** com previsão de preço de ativos: é o público de
  lançamento, e é onde as falhas de compreensão aparecem.
- Uma minoria **com familiaridade** (cripto, apostas de mercado, investimentos),
  como grupo de contraste: eles mostram se o produto frustra quem já sabe.
- Sem colegas da Draftea, sem pessoas que participaram de testes anteriores do
  Pulse.

As duas perguntas iniciais do estudo no Maze — experiência prévia com previsão
de preço e frequência de acompanhar cripto — passam a ser **perguntas de triagem
no recrutamento**, não perguntas de sessão.

## Preparação do protótipo

- **Sessão inteira, incluindo a tarefa 1:** use a URL simples, sem parâmetros —
  `https://design-draftea.github.io/pulse-maze-study/`. Os endereços com
  `mazeStep` existem para o Maze fechar tarefas e não têm função aqui.
- **Tenha `?task=onboarding` à mão como rede de segurança.** Esse é o link da
  tarefa 1 no Maze: abre a introdução já no primeiro card. Use **só** se a pessoa
  não encontrar a explicação sozinha depois de uns três minutos — sem ela ver a
  introdução, as sondas de compreensão perdem o objeto. Registre que foi
  entregue: é resultado, não acidente de condução.
- **A rodada vira a cada 15 minutos.** Comece a tarefa de compra logo depois de
  uma virada, para ter folga. Se a rodada virar com o betslip aberto, ele fecha:
  não é defeito, é o produto protegendo a cotação. Peça para refazer e registre
  a reação — ela é dado.
- Se a compra falhar e a pessoa ficar sem entrada aberta para a tarefa de venda,
  abra `?task=sell`, que garante uma entrada aberta.
- Tenha o link pronto no chat antes de começar, para não gastar tempo de sessão.

## Roteiro

### 1. Abertura e consentimento — 5 min

Apresente-se, explique que a conversa dura cerca de uma hora e que o objetivo é
entender como as pessoas usam um produto novo, não avaliar quem participa.

Deixe explícito:

> Não existe resposta certa nem errada. Se algo ficar confuso, a falha é nossa,
> e é exatamente isso que eu preciso descobrir. Quanto mais você falar em voz
> alta o que está pensando, mesmo que pareça bobagem, mais útil fica.

Peça autorização para gravar, com a gravação já rodando, e confirme que os dados
serão usados só para melhorar o produto.

### 2. Aquecimento e contexto — 10 min

É aqui que a sessão deixa de ser um teste de usabilidade. Não pule para ganhar
tempo: sem esse bloco, as respostas das tarefas ficam sem lastro.

- Como você usa a Draftea hoje? Com que frequência?
- Me conta a última vez que você usou. O que você fez?
- Você já usou algum produto em que apostava se um preço ia subir ou cair?
  (Se sim: como foi? O que te levou a experimentar? Continua usando?)
- Você acompanha o preço do Bitcoin? Onde? Com que frequência?
- Quando você decide colocar dinheiro em algo assim, o que pesa na decisão?
- Me conta uma vez em que você perdeu dinheiro em algo desse tipo. O que
  aconteceu depois?

**Sondas úteis:** "por que isso?", "como assim?", "me dá um exemplo", e o
silêncio de três segundos, que costuma render mais que qualquer pergunta.

### 3. Primeira impressão, sem tarefa — 5 min

Peça para abrir o link e **não faça nenhuma pergunta durante 30 segundos**.
Depois:

- O que é isso, na sua opinião?
- Para que serve? Quem usaria?
- O que dá para fazer aqui?
- Tem alguma coisa nessa tela que você não entendeu?
- O que é esse "Precio objetivo"?
- E esses percentuais em UP e DOWN, o que eles querem dizer?
- **Se você quisesse entender melhor como isso funciona, o que você faria?**
  *(deixe apontar na tela; peça para não clicar ainda)*

Esse bloco não existe no Maze e é o que dá o modelo mental cru, antes de
qualquer explicação. A última pergunta captura a **intenção**; a tarefa seguinte
mostra o **comportamento**. A distância entre as duas é dado: gente que aponta
o ícone certo e depois procura em outro lugar diz mais do que qualquer uma das
duas respostas isolada.

### 4. Tarefa 1 — descobrir como funciona — 8 min

> É a sua primeira vez no Draftea Pulse. Antes de fazer uma operação, descubra
> como ele funciona. Me avise quando sentir que entendeu.

**Este é o bloco de observação mais denso da sessão.** Não ajude, não confirme,
não olhe para o lugar certo. Registre:

- por onde ela vai primeiro — o ícone `?`, o FAQ no rodapé, os cards da Home, ou
  nenhum deles;
- quanto tempo até encontrar a explicação, ou até desistir;
- se o que ela faz bate com o que disse que faria no bloco anterior;
- se ela lê a introdução inteira ou pula cards.

Se passarem uns três minutos sem encontrar, entregue o link `?task=onboarding` —
"achei aqui, dá uma olhada" — e **anote que foi entregue**. Sem ver a introdução
as sondas seguintes não têm objeto, mas o fato de não ter encontrado é o achado.

Depois:

- **Com suas palavras, como funciona uma rodada?** *(pergunta âncora — deixe
  responder inteiro antes de qualquer sonda)*
- Na explicação, UP aparecia em 67%. O que isso significava? *(aberta; se
  travar, pergunte o que era o "67¢" que aparecia junto)*
- Teve algum card que você leu duas vezes?
- Teve alguma palavra ali que você não usaria?
- **Escala 1 a 5:** quanto essa explicação ajudou? E por que esse número?
- O que faltou nela?

### 5. Tarefa 2 — compra — 8 min

> Imagine que você acredita que o preço do Bitcoin vai terminar acima do preço
> objetivo. Use US$10 nessa previsão e confirme a operação.

Enquanto ela faz, anote onde para, o que relê, o que toca sem querer.

Depois:

- Antes de confirmar, o que você esperava que fosse acontecer?
- A tela mostrou um valor em "Ganancia potencial". O que esse valor era?
  *(sonda: esse valor inclui os US$10 que você usou, ou vem além deles?)*
- Se a sua previsão estivesse errada e você segurasse até o fim da rodada, o que
  aconteceria com os US$10?
- **Escala 1 a 5:** quão fácil foi? Por quê?
- Você faria essa mesma operação com dinheiro seu? De quanto seria a sua
  primeira entrada?

### 6. Tarefa 3 — venda — 6 min

> Agora imagine que você mudou de ideia e quer sair antes da rodada terminar.
> Venda toda a sua entrada.

Depois:

- O valor que apareceu para vender era o que você esperava? Por quê?
- O que determina quanto você recebe ao vender antes do fim?
- Em que situação da vida real você venderia antes?
- **Escala 1 a 5:** quão fácil foi? Por quê?

### 7. Tarefa 4 — acompanhamento — 5 min

**Antes de mostrar a tarefa**, pergunte: *"se você quisesse ver todas as
entradas que já fez, inclusive as de rodadas antigas, onde você procuraria?"*
Deixe responder e só então dê a tarefa. Essa ordem substitui a múltipla escolha
do Maze e vale mais do que ela.

> Encontre todas as entradas que você já fez, incluindo as de rodadas que já
> terminaram.

Depois:

- O que você esperava ver nessa tela e não encontrou?
- Qual a diferença entre "Entradas" e "Movimientos", na sua leitura?
- **Escala 1 a 5:** quão fácil foi? Por quê?

### 8. Assistir ao fim de uma rodada — 5 min

Encaixe este bloco no momento em que a rodada estiver virando; ele não precisa
seguir a ordem do roteiro.

Peça que a pessoa observe a virada com uma entrada aberta, se houver, e narre o
que está vendo.

- O que você acha que vai acontecer agora?
- O que aconteceu com a sua entrada?
- Se o preço final tivesse ficado exatamente no preço objetivo, o que
  aconteceria?

Esse é o momento em que "previsão" vira dinheiro. É impossível de observar no
estudo não moderado, porque ninguém espera 15 minutos sozinho.

### 9. Fechamento e profundidade — 8 min

- Imagine que um amigo seu nunca viu isso. Me explica o Pulse como você
  explicaria para ele. *(substitui a matriz de concordância; é o melhor teste de
  compreensão que cabe numa sessão)*
- O que foi mais confuso hoje?
- Se você pudesse mudar uma coisa, o que mudaria primeiro?
- Numa escala de 1 a 5, qual seria o seu interesse em usar isso se estivesse
  disponível? E o que faria esse número subir um ponto?
- Tem alguma coisa que eu não perguntei e que você acha importante?

Agradeça, explique o próximo passo do produto e encerre.

## Notas de condução

- **Não corrija durante a tarefa.** Se a pessoa entender errado, o erro é o
  achado. Explique no fim, se ela quiser saber.
- **Não explique a interface.** Se perguntarem "é aqui que eu clico?", devolva:
  "onde você acha que seria?".
- **Registre a palavra que a pessoa usa** para cada elemento. Se ninguém diz
  "participação", isso é resultado sobre o vocabulário do produto.
- **Uma escala por tarefa, e sempre seguida de "por quê".** O número sozinho não
  serve com seis participantes; a justificativa serve.
- Se a sessão atrasar, corte a tarefa 4 antes de cortar o aquecimento.

## Como cruzar com o estudo no Maze

- A pergunta de `Ganancia potencial` no Maze mede **quantos** confundem o total
  com o ganho. A sessão explica **o que** na tela produz a confusão.
- A pergunta aberta sobre como funciona uma rodada **só existe aqui**, desde que
  saiu do Maze. É a única leitura direta do modelo mental que o estudo terá.
- A descoberta da explicação — se a pessoa a encontra sozinha, e por onde — também
  **só existe aqui**, desde que o link da tarefa 1 no Maze passou a abri-la.
- A tarefa 1 dos dois estudos **não é comparável**, e isso é deliberado. A escala
  de clareza do Maze mede a introdução para quem foi levado até ela; a daqui mede
  para quem a procurou. Não some as duas.
- A alternativa `Movimientos` na tarefa 4 do Maze mede **quantos** procuram no
  lugar errado. A pergunta de expectativa aqui explica **o que** eles esperavam
  encontrar em cada seção.
- A escala de facilidade do Maze dá a distribuição; a justificativa da sessão dá
  a causa.

Rode a sessão moderada **depois** de ter os primeiros números do Maze, se der: os
pontos de maior erro viram as sondas prioritárias, e a hora de conversa rende
mais quando já se sabe onde olhar.
