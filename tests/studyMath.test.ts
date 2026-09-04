import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyWalletPurchase,
  applyWalletSale,
  getWalletPosition,
  type PrototypeWalletState,
} from '../src/services/prototypeWallet.ts'
import {
  STUDY_BOOK_SPREAD,
  STUDY_ROUND_ELAPSED_AT_OPEN_MS,
  STUDY_VALUES,
} from '../src/study/studyConfig.ts'
import {
  buildStudyOutcomeMarket,
  deriveStudyOutcomePrices,
} from '../src/study/studyOutcomeMarket.ts'
import {
  createStudyPriceNoise,
  getStudyPriceAt,
} from '../src/study/studyPriceSeries.ts'

const OPENED_AT = Date.UTC(2026, 8, 4, 12, 0, 0)
const ROUND_START = OPENED_AT - STUDY_ROUND_ELAPSED_AT_OPEN_MS

/**
 * Os formatadores da interface, reproduzidos aqui. O que a pessoa lê é o
 * resultado de um arredondamento, e é esse número que as perguntas do Maze
 * discutem — então ele é o que precisa estar travado, não só a conta interna.
 */
const centsFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const participationFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})
const formatPrice = (price: number) => `${Math.round(price * 100)}¢`

const emptyWallet = (): PrototypeWalletState => ({
  version: 4,
  balanceCents: 204_000,
  positionsByRound: {},
  costBasisCentsByRound: {},
  totalPurchasesCents: 0,
  totalReceivedCents: 0,
  creditedEventIds: [],
  movements: [],
  settledEntries: [],
  revision: 0,
  updatedAt: OPENED_AT,
})

const marketAt = (elapsedSinceOpenMs: number) => {
  const noise = createStudyPriceNoise(
    'buy-maze-v1',
    Math.floor(elapsedSinceOpenMs / 1000) + 1,
  )
  const price = getStudyPriceAt(
    STUDY_ROUND_ELAPSED_AT_OPEN_MS + elapsedSinceOpenMs,
    noise,
  )

  return buildStudyOutcomeMarket({
    currentPrice: price,
    roundSlug: 'study',
    quotedAt: OPENED_AT + elapsedSinceOpenMs,
  })
}

// ---------------------------------------------------------------------------
// O quadro de abertura, idêntico para todo participante
// ---------------------------------------------------------------------------

test('a tarefa abre em 67¢ e 33¢, com venda a 61¢', () => {
  const market = marketAt(0)

  assert.equal(market.displayPrices.up, 0.67)
  assert.equal(market.displayPrices.down, 0.33)
  assert.equal(market.books.up?.bids[0].price, 0.61)
  assert.equal(market.books.down?.bids[0].price, 0.27)
})

test('na abertura, US$10 entrega 10 / 0.67 participações e US$14,93', () => {
  const quote = marketAt(0).quoteBuy('up', 10)

  assert.ok(quote)
  assert.equal(quote.complete, true)
  assert.equal(quote.participations, 10 / 0.67)
  assert.equal(quote.averagePrice, 0.67)
  assert.equal(participationFormatter.format(quote.participations), '14.93')
  assert.equal(centsFormatter.format(quote.participations), '14.93')
  assert.equal(centsFormatter.format(quote.participations - 10), '4.93')
})

test('na abertura, a venda da posição inteira entrega US$9,10', () => {
  const market = marketAt(0)
  const participations = market.quoteBuy('up', 10)!.participations
  const sale = market.quoteSell('up', participations)!

  assert.equal(sale.averagePrice, 0.61)
  assert.equal(formatPrice(sale.averagePrice), '61¢')
  assert.equal(centsFormatter.format(sale.grossValue), '9.10')
})

test('na abertura, o saldo fecha em US$2.030,00 e depois em US$2.039,10', () => {
  const market = marketAt(0)
  const participations = market.quoteBuy('up', 10)!.participations
  const sale = market.quoteSell('up', participations)!

  const afterPurchase = applyWalletPurchase(emptyWallet(), {
    roundStart: ROUND_START,
    side: 'up',
    amountCents: 1_000,
    participations,
  })
  assert.equal(afterPurchase.applied, true)
  assert.equal(afterPurchase.state.balanceCents, 203_000)

  const afterSale = applyWalletSale(afterPurchase.state, {
    roundStart: ROUND_START,
    side: 'up',
    amountReceivedCents: Math.round(sale.grossValue * 100),
    participations,
  })
  assert.equal(afterSale.applied, true)
  assert.equal(afterSale.state.balanceCents, 203_910)
  assert.equal(getWalletPosition(afterSale.state, ROUND_START).up, 0)
})

// ---------------------------------------------------------------------------
// Invariantes que valem em qualquer instante da missão
// ---------------------------------------------------------------------------

const EVERY_SECOND_OF_THE_TASK = Array.from(
  { length: 601 },
  (_, second) => second * 1_000,
)

test('o preço exibido é sempre um número inteiro de centavos', () => {
  EVERY_SECOND_OF_THE_TASK.forEach((elapsed) => {
    const { asks, bids } = deriveStudyOutcomePrices(
      getStudyPriceAt(
        STUDY_ROUND_ELAPSED_AT_OPEN_MS + elapsed,
        createStudyPriceNoise('buy-maze-v1', 601),
      ),
    )

    ;[asks.up, asks.down, bids.up, bids.down].forEach((price) => {
      assert.equal(
        Math.round(price * 100),
        Number((price * 100).toFixed(6)),
        `${price} não é um centavo inteiro em ${elapsed}ms`,
      )
    })
  })
})

test('UP e DOWN somam sempre 100%, com o mesmo spread nos dois lados', () => {
  EVERY_SECOND_OF_THE_TASK.forEach((elapsed) => {
    const market = marketAt(elapsed)
    const up = market.displayPrices.up!
    const down = market.displayPrices.down!

    assert.equal(Math.round((up + down) * 100), 100)
    assert.equal(
      Math.round((up - market.books.up!.bids[0].price) * 100),
      Math.round(STUDY_BOOK_SPREAD * 100),
    )
    assert.equal(
      Math.round((down - market.books.down!.bids[0].price) * 100),
      Math.round(STUDY_BOOK_SPREAD * 100),
    )
  })
})

test('o que a tela mostra é sempre o que a execução cobra', () => {
  EVERY_SECOND_OF_THE_TASK.forEach((elapsed) => {
    const market = marketAt(elapsed)
    const quote = market.quoteBuy('up', 10)!

    // O betslip exibe `Math.round(averagePrice * 100)¢` e a Home exibe
    // `Math.round(price * 100)%`. Se o preço não fosse quantizado, os dois
    // arredondariam para o mesmo rótulo enquanto a conta usaria outro número.
    assert.equal(quote.averagePrice, market.displayPrices.up)
    assert.equal(quote.participations, 10 / market.displayPrices.up!)
    assert.equal(quote.complete, true)
  })
})

test('as participações compradas continuam pagando US$1 cada', () => {
  EVERY_SECOND_OF_THE_TASK.forEach((elapsed) => {
    const quote = marketAt(elapsed).quoteBuy('up', 10)!
    const payout = quote.participations
    const gain = payout - 10

    assert.ok(payout > 10, `o retorno em ${elapsed}ms não supera o monto`)
    assert.ok(gain > 0)
  })
})

/**
 * A proteção de execução do betslip recusa uma piora maior que 1¢ entre a
 * cotação e a confirmação. O gesto de deslizar leva cerca de 2,3s, então um
 * mercado que se mexesse mais rápido do que isso faria a compra ser recusada no
 * meio da tarefa — e o participante veria um erro que não existe no produto.
 */
test('o preço nunca se move mais de 1¢ em três segundos', () => {
  const noise = createStudyPriceNoise('buy-maze-v1', 601)
  const priceAt = (second: number) => deriveStudyOutcomePrices(
    getStudyPriceAt(STUDY_ROUND_ELAPSED_AT_OPEN_MS + second * 1_000, noise),
  ).asks.up

  for (let second = 0; second + 3 <= 600; second += 1) {
    const move = Math.abs(priceAt(second + 3) - priceAt(second))

    assert.ok(
      move <= 0.01 + 1e-9,
      `movimento de ${(move * 100).toFixed(2)}¢ entre ${second}s e ${second + 3}s`,
    )
  }
})

test('o mercado se move de verdade ao longo da missão', () => {
  const observados = new Set(
    EVERY_SECOND_OF_THE_TASK.map((elapsed) => marketAt(elapsed).displayPrices.up),
  )

  assert.ok(
    observados.size >= 3,
    `UP assumiu só ${observados.size} valor(es) em dez minutos`,
  )
  assert.ok(
    observados.size <= 12,
    `UP assumiu ${observados.size} valores: instável demais para a tarefa`,
  )
})

test('o preço do Bitcoin se move e continua perto do objetivo', () => {
  const noise = createStudyPriceNoise('buy-maze-v1', 601)
  const precos = EVERY_SECOND_OF_THE_TASK.map((elapsed) => (
    getStudyPriceAt(STUDY_ROUND_ELAPSED_AT_OPEN_MS + elapsed, noise)
  ))

  assert.equal(precos[0], STUDY_VALUES.initialCurrentPrice)
  assert.ok(new Set(precos).size > 300, 'o preço ficou parado')
  precos.forEach((preco) => {
    assert.ok(
      Math.abs(preco - STUDY_VALUES.targetPrice) < 60,
      `${preco} se afastou demais do preço objetivo`,
    )
  })
})
