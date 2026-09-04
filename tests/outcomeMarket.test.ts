import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addPurchasedParticipations,
  INITIAL_PARTICIPATIONS,
  applyOrderBookPriceChange,
  createMutableOrderBook,
  getDisplayedOutcomePrice,
  mapOutcomeTokens,
  quoteOrderBook,
  removeSoldParticipations,
  replaceOrderBookSnapshot,
  snapshotOrderBook,
  type OutcomeOrderBook,
} from '../src/services/outcomeMarket.ts'

const book = (
  bids: OutcomeOrderBook['bids'],
  asks: OutcomeOrderBook['asks'],
  lastTradePrice: number | null = null,
): OutcomeOrderBook => ({ bids, asks, lastTradePrice })

test('inicia UP e DOWN sem participações disponíveis para venda', () => {
  assert.deepEqual(INITIAL_PARTICIPATIONS, { up: 0, down: 0 })
})

test('a compra adiciona participações somente ao lado executado', () => {
  const updated = addPurchasedParticipations(INITIAL_PARTICIPATIONS, {
    side: 'down',
    operation: 'buy',
    requestedValue: 10,
    participations: 12.5,
    grossValue: 10,
    averagePrice: 0.8,
    complete: true,
    quotedAt: 123,
  })

  assert.deepEqual(updated, { up: 0, down: 12.5 })
  assert.deepEqual(INITIAL_PARTICIPATIONS, { up: 0, down: 0 })
})

test('a venda remove somente as participações executadas do lado vendido', () => {
  const updated = removeSoldParticipations({ up: 20, down: 8 }, {
    side: 'up',
    operation: 'sell',
    requestedValue: 7.5,
    participations: 7.5,
    grossValue: 3.75,
    averagePrice: 0.5,
    complete: true,
    quotedAt: 456,
  })

  assert.deepEqual(updated, { up: 12.5, down: 8 })
})

test('mapeia UP e DOWN aos token IDs independentemente da ordem', () => {
  assert.deepEqual(
    mapOutcomeTokens('["Down","Up"]', '["down-token","up-token"]'),
    { up: 'up-token', down: 'down-token' },
  )
  assert.equal(mapOutcomeTokens('["Yes","No"]', '["1","2"]'), null)
})

test('usa midpoint quando o spread é de até 10 centavos', () => {
  const price = getDisplayedOutcomePrice(book(
    [{ price: 0.44, size: 10 }],
    [{ price: 0.5, size: 10 }],
    0.46,
  ))

  assert.equal(price, 0.47)
})

test('usa a última negociação com spread acima de 10 centavos', () => {
  const wideBook = book(
    [{ price: 0.35, size: 10 }],
    [{ price: 0.55, size: 10 }],
    0.48,
  )

  assert.equal(getDisplayedOutcomePrice(wideBook), 0.48)
  assert.equal(getDisplayedOutcomePrice({ ...wideBook, lastTradePrice: null }), null)
})

test('substitui snapshot, atualiza e remove níveis do livro', () => {
  const mutableBook = createMutableOrderBook()
  replaceOrderBookSnapshot(
    mutableBook,
    [{ price: '0.40', size: '5' }, { price: '0.42', size: '3' }],
    [{ price: '0.50', size: '4' }],
  )

  assert.equal(applyOrderBookPriceChange(mutableBook, {
    side: 'BUY',
    price: '0.42',
    size: '0',
  }), true)
  assert.equal(applyOrderBookPriceChange(mutableBook, {
    side: 'SELL',
    price: '0.48',
    size: '2',
  }), true)

  assert.deepEqual(snapshotOrderBook(mutableBook), {
    bids: [{ price: 0.4, size: 5 }],
    asks: [{ price: 0.48, size: 2 }, { price: 0.5, size: 4 }],
    lastTradePrice: null,
  })
})

test('calcula VWAP de compra em um e vários níveis', () => {
  const quote = quoteOrderBook(book(
    [{ price: 0.4, size: 100 }],
    [{ price: 0.5, size: 10 }, { price: 0.6, size: 10 }],
  ), 'up', 'buy', 8, 123)

  assert.ok(quote)
  assert.equal(quote.complete, true)
  assert.equal(quote.participations, 15)
  assert.equal(quote.grossValue, 8)
  assert.equal(quote.averagePrice, 8 / 15)
  assert.equal(quote.quotedAt, 123)
})

test('calcula VWAP de venda consumindo bids em ordem decrescente', () => {
  const quote = quoteOrderBook(book(
    [{ price: 0.6, size: 4 }, { price: 0.5, size: 10 }],
    [{ price: 0.7, size: 100 }],
  ), 'down', 'sell', 10, 456)

  assert.ok(quote)
  assert.equal(quote.complete, true)
  assert.equal(quote.participations, 10)
  assert.equal(quote.grossValue, 5.4)
  assert.equal(quote.averagePrice, 0.54)
})

test('marca a cotação como incompleta quando falta liquidez', () => {
  const buyQuote = quoteOrderBook(book(
    [{ price: 0.4, size: 2 }],
    [{ price: 0.5, size: 2 }],
  ), 'up', 'buy', 2)
  const sellQuote = quoteOrderBook(book(
    [{ price: 0.4, size: 2 }],
    [{ price: 0.5, size: 2 }],
  ), 'up', 'sell', 3)

  assert.equal(buyQuote?.complete, false)
  assert.equal(sellQuote?.complete, false)
  assert.equal(quoteOrderBook(book([], []), 'up', 'buy', Number.NaN), null)
})
