import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateFallbackOutcomePrices,
  createSyntheticOutcomeMarket,
  deserializeMarketRoundCache,
  selectFreshPriceFeed,
  serializeMarketRoundCache,
  smoothFallbackOutcomePrices,
  upsertCachedMarketRound,
  type CachedMarketRound,
} from '../src/services/marketFallback.ts'
import { quoteOrderBook } from '../src/services/outcomeMarket.ts'
import {
  applyWalletPurchase,
  applyWalletSale,
  createInitialWalletState,
  getWalletPosition,
} from '../src/services/prototypeWallet.ts'

test('seleciona o feed fresco pela prioridade Chainlink, Coinbase e Kraken', () => {
  const now = 100_000
  const candidates = [
    { source: 'kraken' as const, value: 80_010, updatedAt: now },
    { source: 'coinbase' as const, value: 80_005, updatedAt: now },
    { source: 'chainlink' as const, value: 80_000, updatedAt: now - 11_000 },
  ]

  assert.equal(selectFreshPriceFeed(candidates, now)?.source, 'coinbase')
  assert.equal(
    selectFreshPriceFeed([
      ...candidates,
      { source: 'chainlink' as const, value: 80_001, updatedAt: now },
    ], now)?.source,
    'chainlink',
  )
})

test('calcula probabilidades complementares, direcionais e limitadas', () => {
  assert.deepEqual(
    calculateFallbackOutcomePrices(80_000, 80_000, 900),
    { up: 0.5, down: 0.5 },
  )

  const above = calculateFallbackOutcomePrices(80_080, 80_000, 60)
  const below = calculateFallbackOutcomePrices(79_920, 80_000, 60)
  const early = calculateFallbackOutcomePrices(80_040, 80_000, 900)
  const late = calculateFallbackOutcomePrices(80_040, 80_000, 30)

  assert.ok(above.up > 0.5)
  assert.ok(below.down > 0.5)
  assert.equal(above.up + above.down, 1)
  assert.equal(below.up + below.down, 1)
  assert.ok(above.up <= 0.97)
  assert.ok(below.up >= 0.03)
  assert.ok(late.up > early.up)
})

test('suaviza a probabilidade sem quebrar a complementaridade', () => {
  const smoothed = smoothFallbackOutcomePrices(
    { up: 0.5, down: 0.5 },
    { up: 0.9, down: 0.1 },
  )

  assert.ok(Math.abs(smoothed.up - 0.58) < 1e-9)
  assert.equal(smoothed.up + smoothed.down, 1)
})

test('gera cinco níveis válidos e liquidez para todo o saldo do protótipo', () => {
  const market = createSyntheticOutcomeMarket({ up: 0.97, down: 0.03 })

  for (const side of ['up', 'down'] as const) {
    assert.equal(market.books[side].bids.length, 5)
    assert.equal(market.books[side].asks.length, 5)
    assert.ok(market.books[side].bids.every(({ price }) => price > 0 && price < 1))
    assert.ok(market.books[side].asks.every(({ price }) => price > 0 && price < 1))
    assert.equal(
      quoteOrderBook(market.books[side], side, 'buy', 2_149.25)?.complete,
      true,
    )
  }
})

test('livro sintético mantém compra e venda da carteira funcionando', () => {
  const roundStart = 1_800_000_000_000
  const market = createSyntheticOutcomeMarket({ up: 0.62, down: 0.38 })
  const buyQuote = quoteOrderBook(market.books.up, 'up', 'buy', 50)

  assert.ok(buyQuote?.complete)
  const purchase = applyWalletPurchase(createInitialWalletState(), {
    roundStart,
    side: 'up',
    amountCents: 5_000,
    participations: buyQuote.participations,
  })
  assert.equal(purchase.applied, true)

  const owned = getWalletPosition(purchase.state, roundStart).up
  const sellQuote = quoteOrderBook(market.books.up, 'up', 'sell', owned)
  assert.ok(sellQuote?.complete)

  const sale = applyWalletSale(purchase.state, {
    roundStart,
    side: 'up',
    amountReceivedCents: Math.round(sellQuote.grossValue * 100),
    participations: sellQuote.participations,
  })
  assert.equal(sale.applied, true)
  assert.equal(getWalletPosition(sale.state, roundStart).up, 0)
})

test('cache ignora dados inválidos, substitui por rodada e limita doze itens', () => {
  assert.deepEqual(deserializeMarketRoundCache('{'), [])
  assert.deepEqual(deserializeMarketRoundCache('[{"roundStart":"x"}]'), [])
  assert.equal(deserializeMarketRoundCache(JSON.stringify([{
    roundStart: 1_799_999_100_000,
    targetPrice: 80_000,
    finalPrice: 80_010,
    source: 'local',
  }]))[0]?.result, 'up')

  let rounds: CachedMarketRound[] = []
  for (let index = 0; index < 14; index += 1) {
    rounds = upsertCachedMarketRound(rounds, {
      roundStart: 1_800_000_000_000 + index * 900_000,
      targetPrice: 80_000 + index,
      finalPrice: null,
      result: null,
      source: 'local',
    })
  }

  const newest = rounds[0]
  rounds = upsertCachedMarketRound(rounds, {
    ...newest,
    finalPrice: newest.targetPrice + 10,
    result: 'up',
  })

  assert.equal(rounds.length, 12)
  assert.equal(rounds[0].finalPrice, rounds[0].targetPrice + 10)
  assert.equal(rounds[0].result, 'up')
  assert.deepEqual(
    deserializeMarketRoundCache(serializeMarketRoundCache(rounds)),
    rounds,
  )
})
