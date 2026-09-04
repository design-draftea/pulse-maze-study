import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import {
  helpFaqItems,
  helpSmallTalkItems,
  helpTopicItems,
} from '../src/content/help/es-MX/helpContent.ts'
import { askHelpAssistant } from '../src/services/helpAssistant.ts'
import { buildHelpAssistantSnapshot } from '../src/services/helpAssistantSnapshot.ts'
import { getWalletProfileMetrics } from '../src/services/prototypeWallet.ts'
import { STUDY_VALUES } from '../src/study/studyConfig.ts'
import { buildStudyMarketRound } from '../src/study/studyMarketRound.ts'
import { buildStudyOutcomeMarket } from '../src/study/studyOutcomeMarket.ts'
import { STUDY_FORBIDDEN_CONTENT_PHRASES } from '../src/study/studyHelpContent.ts'
import { installFakeWindow, uninstallFakeWindow } from './studyTestEnv.ts'

const BASE = 'https://pulse-maze.draftea.com/'
const OPENED_AT = Date.UTC(2026, 8, 4, 12, 0, 0)

const openTask = async (task: string) => {
  installFakeWindow(`${BASE}?task=${task}&mazeStep=start`)
  const { prepareStudyScenario } = await import(
    `../src/study/studyScenarios.ts?case=${Math.random()}`
  )
  const resolution = prepareStudyScenario(OPENED_AT)
  assert.equal(resolution.status, 'ready')

  return resolution.scenario
}

/** O mesmo retrato que o `App` entrega ao assistente, montado com dados do estudo. */
const buildStudySnapshotAt = async (task: string, elapsedMs = 0) => {
  const scenario = await openTask(task)
  const at = OPENED_AT + elapsedMs
  const round = buildStudyMarketRound(scenario, at)
  const market = buildStudyOutcomeMarket({
    currentPrice: round.currentPrice,
    roundSlug: round.roundSlug,
    quotedAt: at,
  })
  const position = scenario.wallet.positionsByRound[String(round.roundStart)]
    ?? { up: 0, down: 0 }
  const costBasis = scenario.wallet.costBasisCentsByRound[String(round.roundStart)]
    ?? { up: 0, down: 0 }

  return {
    round,
    market,
    snapshot: buildHelpAssistantSnapshot({
      isRoundClosing: false,
      market: { prices: market.displayPrices, status: market.status },
      now: round.now,
      pendingRoundStarts: [],
      position,
      positionCostCents: costBasis,
      previousRounds: round.previousRounds.map(({ result, roundStart }) => ({
        result,
        roundStart,
      })),
      quoteBuy: market.quoteBuy,
      quoteSell: market.quoteSell,
      round: {
        currentPrice: round.currentPrice,
        endTime: round.endTime,
        remainingSeconds: round.remainingSeconds,
        targetPrice: round.targetPrice,
      },
      settledEntries: scenario.wallet.settledEntries,
      wallet: getWalletProfileMetrics(scenario.wallet, round.roundStart, null),
    }),
  }
}

const buildStudySnapshot = (task: string) => buildStudySnapshotAt(task)

const ask = (query: string, snapshot: ReturnType<typeof buildHelpAssistantSnapshot>) =>
  askHelpAssistant(query, {
    availableBalanceCents: snapshot.wallet.availableBalanceCents,
    hasOpenEntries: snapshot.wallet.openEntriesCents > 0,
    live: snapshot,
  })

test.afterEach(() => uninstallFakeWindow())

test('a pergunta sobre diferença de preço resolve a FAQ correta', async () => {
  const { snapshot } = await buildStudySnapshot('help')
  const variations = [
    '¿Por qué el precio puede ser diferente al de otras plataformas?',
    '¿Por qué aquí aparece otro precio?',
    'el precio es distinto al que veo en otro lugar',
    '¿Por qué no coincide con otra app?',
    'porque el precio de bitcoin es diferente en otra plataforma',
    'el precio de bitcoin aquí es diferente al de otra plataforma',
    'por que el precio no es igual al de binance',
  ]

  variations.forEach((query) => {
    const result = ask(query, snapshot)

    assert.equal(
      result.source?.id,
      'price-difference',
      `"${query}" não resolveu a FAQ de diferença de preço`,
    )
    assert.equal(result.source?.type, 'faq')
    assert.equal(result.confidence, 'high')
  })
})

test('a resposta de diferença de preço mantém o texto aprovado', () => {
  const faq = helpFaqItems.find(({ id }) => id === 'price-difference')

  assert.ok(faq)
  assert.equal(
    faq.answer,
    'Cada plataforma puede consultar una fuente distinta o actualizar el precio en momentos diferentes. Por eso pueden existir pequeñas variaciones entre los valores mostrados. Para definir el resultado, Pulse utiliza la referencia establecida para la ronda.',
  )
})

test('os números do assistente coincidem com a Home', async () => {
  const { snapshot, round } = await buildStudySnapshot('help')

  const probability = ask('¿Cuál es la probabilidad de UP?', snapshot)
  assert.match(probability.answer, /67\s*%/)
  assert.match(probability.answer, /33\s*%/)

  // O que importa não é o par 67/33, que só vale na abertura: é o assistente
  // nunca discordar da Home. Os dois arredondam o mesmo preço do mesmo livro.
  const emCincoMinutos = await buildStudySnapshotAt('help', 5 * 60_000)
  const maisTarde = ask('¿Cuál es la probabilidad de UP?', emCincoMinutos.snapshot)
  const upNaHome = Math.round(emCincoMinutos.market.displayPrices.up! * 100)
  const downNaHome = Math.round(emCincoMinutos.market.displayPrices.down! * 100)

  assert.match(maisTarde.answer, new RegExp(`${upNaHome}\\s*%`))
  assert.match(maisTarde.answer, new RegExp(`${downNaHome}\\s*%`))

  const price = ask('¿Cuál es el precio actual de Bitcoin?', snapshot)
  assert.match(price.answer, /80,012\.40/)
  assert.equal(round.currentPrice, STUDY_VALUES.initialCurrentPrice)
  assert.equal(round.targetPrice, STUDY_VALUES.targetPrice)

  // O preço objetivo acompanha a resposta da rodada nos detalhes.
  const roundState = ask('¿Cómo va la ronda?', snapshot)
  const roundText = [roundState.answer, ...(roundState.details ?? [])].join(' ')
  assert.match(roundText, /80,000/)
  assert.match(roundText, /80,012\.40/)

  // O contador do assistente é o mesmo relógio virtual da Home.
  const time = ask('¿Cuánto tiempo queda en la ronda?', snapshot)
  assert.match(time.answer, /Quedan 14:00/)
  assert.equal(round.minutes, '14')
  assert.equal(round.seconds, '00')

  const maisTardeNoRelogio = await buildStudySnapshotAt('help', 4 * 60_000)
  const tempo = ask(
    '¿Cuánto tiempo queda en la ronda?',
    maisTardeNoRelogio.snapshot,
  )
  assert.match(tempo.answer, /Quedan 10:00/)
})

test('o assistente lê o saldo e a posição do cenário simulado', async () => {
  const help = await buildStudySnapshot('help')
  const balance = ask('¿Cuál es mi saldo?', help.snapshot)
  assert.match(balance.answer, /2,040\.00/)
  uninstallFakeWindow()

  const sell = await buildStudySnapshot('sell')
  const sellBalance = ask('¿Cuál es mi saldo?', sell.snapshot)
  assert.match(sellBalance.answer, /2,030\.00/)

  const position = ask('¿Cómo va mi entrada?', sell.snapshot)
  assert.match(position.answer, /14\.93/)
  assert.match(position.answer, /UP/)
})

test('o valor de venda oferecido bate com os US$9,10 da tarefa', async () => {
  const { snapshot } = await buildStudySnapshot('sell')
  const result = ask('¿Cuánto recibo si vendo ahora?', snapshot)

  assert.match(result.answer, /9\.10/)
})

test('a contagem do histórico usa as dez rodadas fixas', async () => {
  const { snapshot } = await buildStudySnapshot('help')
  const result = ask('¿Cuántas rondas terminaron arriba?', snapshot)

  assert.match(result.answer, /5/)
  assert.equal(snapshot.previousRounds.length, 10)
})

test('as proteções de recomendação continuam funcionando', async () => {
  const { snapshot } = await buildStudySnapshot('help')

  for (const query of [
    '¿Qué me recomiendas, UP o DOWN?',
    '¿Bitcoin va a subir hoy?',
  ]) {
    const result = ask(query, snapshot)

    assert.equal(result.confidence, 'high', `"${query}" perdeu a guarda`)
    assert.equal(result.source?.type, 'policy', `"${query}" saiu da política`)
    assert.match(
      result.answer,
      /no puedo recomendar|no puedo.*predecir/,
      `"${query}" deixou de ser recusada`,
    )
  }

  // A recusa continua entregando o dado honesto que existe no lugar da opinião.
  const advice = ask('¿Qué me recomiendas, UP o DOWN?', snapshot)
  assert.match(advice.answer, /67/)
})

test('nenhuma resposta chama os dados do estudo de reais', () => {
  const offenders: string[] = []
  const check = (id: string, text: string) => {
    STUDY_FORBIDDEN_CONTENT_PHRASES.forEach((phrase) => {
      if (text.toLowerCase().includes(phrase)) offenders.push(`${id}: ${phrase}`)
    })
  }

  helpFaqItems.forEach((item) => check(item.id, item.answer))
  helpTopicItems.forEach((item) => check(item.id, item.description))
  helpSmallTalkItems.forEach((item) => check(item.id, item.answer))

  assert.deepEqual(offenders, [])
})

test('a sobreposição do estudo está aplicada no catálogo publicado', () => {
  const capabilities = helpSmallTalkItems.find(({ id }) => id === 'capabilities')
  const isMoneyReal = helpTopicItems.find(({ id }) => id === 'is-money-real')
  const priceSource = helpFaqItems.find(({ id }) => id === 'where-price-comes-from')

  assert.ok(capabilities && isMoneyReal && priceSource)
  assert.match(capabilities.answer, /datos de esta ronda/)
  assert.match(isMoneyReal.description, /todo es simulado/)
  assert.match(priceSource.answer, /simulados/)
})

test('o campo livre do assistente é mascarado para o Maze', () => {
  const source = readFileSync(
    'src/components/HelpAssistant/HelpAssistant.tsx',
    'utf8',
  )

  assert.match(source, /data-maze-mask="True"/)
})
