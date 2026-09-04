import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyWalletPurchase,
  applyWalletSale,
  getWalletPosition,
} from '../src/services/prototypeWallet.ts'
import { buildStudyOutcomeMarket } from '../src/study/studyOutcomeMarket.ts'
import { STUDY_VALUES } from '../src/study/studyConfig.ts'
import { installFakeWindow, uninstallFakeWindow } from './studyTestEnv.ts'

const OPENED_AT = Date.UTC(2026, 8, 4, 12, 0, 0)
const ROUND_START = OPENED_AT - 5 * 60 * 1000

/**
 * Os formatadores da interface, reproduzidos aqui. O que a pessoa lê é o
 * resultado de um arredondamento, e é esse número que as perguntas do Maze
 * citam — então ele é o que precisa estar travado, não só a conta interna.
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

const buildMarket = () => {
  installFakeWindow('https://pulse-maze.draftea.com/?task=buy&mazeStep=start')

  return buildStudyOutcomeMarket({
    scenario: {
      id: 'buy-maze-v1',
      task: 'buy',
      startSection: 'home',
      market: {
        targetPrice: STUDY_VALUES.targetPrice,
        currentPrice: STUDY_VALUES.initialCurrentPrice,
        prices: { up: STUDY_VALUES.upBuyPrice, down: STUDY_VALUES.downBuyPrice },
        sellPrices: {
          up: STUDY_VALUES.sellPrice,
          down: STUDY_VALUES.downSellPrice,
        },
      },
      wallet: {} as never,
      onboarding: { completed: true },
      openedAt: OPENED_AT,
    },
    roundSlug: 'study',
    quotedAt: OPENED_AT,
  })
}

test.afterEach(() => uninstallFakeWindow())

test('US$10 a 67¢ entrega 10 / 0.67 participações', () => {
  const quote = buildMarket().quoteBuy('up', 10)

  assert.ok(quote)
  assert.equal(quote.complete, true)
  assert.equal(quote.participations, 10 / 0.67)
  assert.equal(quote.averagePrice, 0.67)
  assert.equal(quote.grossValue, 10)
})

test('a interface mostra 14.93 participações e 67¢', () => {
  const quote = buildMarket().quoteBuy('up', 10)!

  assert.equal(participationFormatter.format(quote.participations), '14.93')
  assert.equal(formatPrice(quote.averagePrice), '67¢')
})

test('o total em caso de acerto mostra US$14,93 e o ganho US$4,93', () => {
  const quote = buildMarket().quoteBuy('up', 10)!
  // Cada participação vencedora paga US$1, então o total recebido é a própria
  // contagem de participações.
  const payout = quote.participations
  const gain = payout - 10

  assert.equal(centsFormatter.format(payout), '14.93')
  assert.equal(centsFormatter.format(gain), '4.93')
})

test('a venda a 61¢ entrega US$9,10', () => {
  const market = buildMarket()
  const participations = market.quoteBuy('up', 10)!.participations
  const sale = market.quoteSell('up', participations)

  assert.ok(sale)
  assert.equal(sale.complete, true)
  assert.equal(sale.averagePrice, 0.61)
  assert.equal(formatPrice(sale.averagePrice), '61¢')
  assert.equal(sale.grossValue, participations * 0.61)
  assert.equal(centsFormatter.format(sale.grossValue), '9.10')
})

test('a liquidez simulada cobre toda a compra e toda a venda', () => {
  const market = buildMarket()

  assert.equal(market.quoteBuy('up', 10)?.complete, true)
  assert.equal(market.quoteBuy('down', 10)?.complete, true)
  assert.equal(market.quoteSell('up', 10 / 0.67)?.complete, true)
})

test('o saldo fecha em US$2.030,00 depois da compra', () => {
  const market = buildMarket()
  const quote = market.quoteBuy('up', 10)!
  const initial = {
    version: 4 as const,
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
  }

  const purchase = applyWalletPurchase(initial, {
    roundStart: ROUND_START,
    side: 'up',
    amountCents: 1_000,
    participations: quote.participations,
  })

  assert.equal(purchase.applied, true)
  assert.equal(purchase.state.balanceCents, 203_000)
  assert.equal(
    getWalletPosition(purchase.state, ROUND_START).up,
    10 / 0.67,
  )
})

test('o saldo fecha em US$2.039,10 depois da venda', () => {
  const market = buildMarket()
  const participations = market.quoteBuy('up', 10)!.participations
  const sale = market.quoteSell('up', participations)!
  const afterPurchase = applyWalletPurchase({
    version: 4 as const,
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
  }, {
    roundStart: ROUND_START,
    side: 'up',
    amountCents: 1_000,
    participations,
  }).state

  const afterSale = applyWalletSale(afterPurchase, {
    roundStart: ROUND_START,
    side: 'up',
    amountReceivedCents: Math.round(sale.grossValue * 100),
    participations,
  })

  assert.equal(afterSale.applied, true)
  assert.equal(afterSale.state.balanceCents, 203_910)
  assert.equal(getWalletPosition(afterSale.state, ROUND_START).up, 0)
})
