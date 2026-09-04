const UPSTREAM_ORIGIN = 'https://polymarket.com'
const TARGET_PATH = '/crypto/crypto-price'
const UPSTREAM_PATH = '/api/crypto/crypto-price'
const ROUND_DURATION_MS = 15 * 60 * 1000

const CORS_HEADERS = {
  'Access-Control-Allow-Headers': 'Accept, Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Max-Age': '86400',
}

const jsonResponse = (payload, status = 200, extraHeaders = {}) => new Response(
  JSON.stringify(payload),
  {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
  },
)

const isValidRoundRequest = (url) => {
  const symbol = url.searchParams.get('symbol')
  const variant = url.searchParams.get('variant')
  const startTime = Date.parse(url.searchParams.get('eventStartTime') ?? '')
  const endTime = Date.parse(url.searchParams.get('endDate') ?? '')

  return symbol === 'BTC'
    && variant === 'fifteen'
    && Number.isFinite(startTime)
    && Number.isFinite(endTime)
    && endTime - startTime === ROUND_DURATION_MS
}

export const handleRequest = async (request, upstreamFetch = fetch) => {
  if (request.method === 'OPTIONS') return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  })

  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const requestUrl = new URL(request.url)
  if (requestUrl.pathname === '/health') {
    return jsonResponse({ status: 'ok' }, 200, {
      'Cache-Control': 'no-store',
    })
  }

  if (requestUrl.pathname !== TARGET_PATH) {
    return jsonResponse({ error: 'Not found' }, 404)
  }

  if (!isValidRoundRequest(requestUrl)) {
    return jsonResponse({ error: 'Invalid BTC round request' }, 400)
  }

  const upstreamUrl = new URL(UPSTREAM_PATH, UPSTREAM_ORIGIN)
  upstreamUrl.search = requestUrl.search

  try {
    const upstreamResponse = await upstreamFetch(upstreamUrl, {
      headers: { Accept: 'application/json' },
    })
    const body = await upstreamResponse.text()

    return new Response(body, {
      status: upstreamResponse.status,
      headers: {
        ...CORS_HEADERS,
        'Cache-Control': upstreamResponse.ok
          ? 'public, max-age=5, stale-while-revalidate=30'
          : 'no-store',
        'Content-Type': upstreamResponse.headers.get('Content-Type')
          ?? 'application/json; charset=utf-8',
      },
    })
  } catch {
    return jsonResponse({ error: 'Upstream unavailable' }, 502, {
      'Cache-Control': 'no-store',
    })
  }
}

export default {
  fetch(request) {
    return handleRequest(request)
  },
}
