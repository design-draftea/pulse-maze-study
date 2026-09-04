import assert from 'node:assert/strict'
import test from 'node:test'
import worker, { handleRequest } from '../infra/polymarket-proxy/src/index.mjs'

const VALID_QUERY = new URLSearchParams({
  symbol: 'BTC',
  eventStartTime: '2026-09-01T15:00:00Z',
  variant: 'fifteen',
  endDate: '2026-09-01T15:15:00Z',
})

test('responde ao health check com CORS', async () => {
  const response = await handleRequest(
    new Request('https://proxy.example/health'),
  )

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*')
  assert.deepEqual(await response.json(), { status: 'ok' })
})

test('rejeita caminhos e métodos que não fazem parte do proxy', async () => {
  const notFound = await handleRequest(
    new Request('https://proxy.example/anything'),
  )
  const methodNotAllowed = await handleRequest(
    new Request('https://proxy.example/crypto/crypto-price', { method: 'POST' }),
  )

  assert.equal(notFound.status, 404)
  assert.equal(methodNotAllowed.status, 405)
})

test('rejeita uma janela de rodada inválida sem consultar a origem', async () => {
  let upstreamCalls = 0
  const response = await handleRequest(
    new Request('https://proxy.example/crypto/crypto-price?symbol=ETH'),
    async () => {
      upstreamCalls += 1
      return new Response('{}')
    },
  )

  assert.equal(response.status, 400)
  assert.equal(upstreamCalls, 0)
})

test('encaminha somente a consulta BTC válida e preserva a resposta', async () => {
  let forwardedUrl = ''
  const response = await handleRequest(
    new Request(`https://proxy.example/crypto/crypto-price?${VALID_QUERY}`),
    async (url) => {
      forwardedUrl = String(url)
      return new Response(JSON.stringify({ openPrice: 78_000 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    },
  )

  assert.equal(response.status, 200)
  assert.equal(
    forwardedUrl,
    `https://polymarket.com/api/crypto/crypto-price?${VALID_QUERY}`,
  )
  assert.deepEqual(await response.json(), { openPrice: 78_000 })
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*')
})

test('adapta a assinatura do runtime sem tratar env como fetch', async () => {
  const originalFetch = globalThis.fetch
  let forwardedUrl = ''

  globalThis.fetch = async (url) => {
    forwardedUrl = String(url)
    return new Response(JSON.stringify({ openPrice: 78_000 }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const response = await worker.fetch(
      new Request(`https://proxy.example/crypto/crypto-price?${VALID_QUERY}`),
      { ignoredEnvBinding: true },
      { ignoredExecutionContext: true },
    )

    assert.equal(response.status, 200)
    assert.equal(
      forwardedUrl,
      `https://polymarket.com/api/crypto/crypto-price?${VALID_QUERY}`,
    )
    assert.deepEqual(await response.json(), { openPrice: 78_000 })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('converte falha de rede da origem em 502', async () => {
  const response = await handleRequest(
    new Request(`https://proxy.example/crypto/crypto-price?${VALID_QUERY}`),
    async () => { throw new Error('offline') },
  )

  assert.equal(response.status, 502)
  assert.deepEqual(await response.json(), { error: 'Upstream unavailable' })
})
