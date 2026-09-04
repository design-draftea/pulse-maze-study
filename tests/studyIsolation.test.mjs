import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync, globSync } from 'node:fs'

/**
 * Endpoints que não podem existir nesta cópia, nem no código executável nem no
 * bundle publicado. A varredura ignora a documentação de propósito: os
 * documentos do estudo precisam poder registrar o que foi removido, e é
 * justamente esse registro que explica a diferença para o Pulse principal.
 */
const FORBIDDEN = [
  'polymarket.com',
  'ws-live-data.polymarket.com',
  'coinbase.com',
  'kraken.com',
  'gamma-api',
  'clob',
  'VITE_POLYMARKET_PROXY_ORIGIN',
]

const RUNTIME_GLOBS = [
  'src/**/*.{ts,tsx,js,mjs,css}',
  'index.html',
  'vite.config.ts',
]

const scan = (files) => {
  const offenders = []

  files.forEach((file) => {
    const source = readFileSync(file, 'utf8').toLowerCase()
    FORBIDDEN.forEach((needle) => {
      if (source.includes(needle.toLowerCase())) {
        offenders.push(`${file}: ${needle}`)
      }
    })
  })

  return offenders
}

test('os arquivos de runtime não contêm os endpoints proibidos', () => {
  const files = RUNTIME_GLOBS.flatMap((pattern) => globSync(pattern))

  assert.ok(files.length > 0, 'a varredura não encontrou arquivos de runtime')
  assert.deepEqual(scan(files), [])
})

test('nenhum WebSocket de mercado sobrevive no runtime', () => {
  const files = globSync('src/**/*.{ts,tsx}')
  const offenders = files.filter((file) => (
    /new\s+WebSocket\s*\(/.test(readFileSync(file, 'utf8'))
  ))

  assert.deepEqual(offenders, [])
})

test('nenhuma chamada de rede sobrevive no runtime', () => {
  const files = globSync('src/**/*.{ts,tsx}')
  const offenders = files.filter((file) => (
    /(^|[^.\w])fetch\s*\(/.test(readFileSync(file, 'utf8'))
  ))

  assert.deepEqual(offenders, [])
})

test('o proxy e o worker de mercado não existem mais na árvore', () => {
  assert.equal(existsSync('infra/polymarket-proxy'), false)
  assert.equal(existsSync('.github/workflows/deploy-market-proxy.yml'), false)
  assert.deepEqual(globSync('src/hooks/useOutcomeMarket.ts'), [])
  assert.deepEqual(globSync('src/hooks/useBtcPriceFeeds.ts'), [])
  assert.deepEqual(globSync('src/services/marketFallback.ts'), [])
})

test('o bundle publicado não contém os endpoints proibidos', (t) => {
  const bundle = globSync('dist/**/*.{js,css,html}')

  if (bundle.length === 0) {
    t.skip('rode `pnpm build` antes: o teste audita o artefato publicado')
    return
  }

  assert.deepEqual(scan(bundle), [])
})

test('o bundle só fala com as fontes tipográficas e com o Maze', (t) => {
  const bundle = globSync('dist/**/*.{js,html}')

  if (bundle.length === 0) {
    t.skip('rode `pnpm build` antes: o teste audita o artefato publicado')
    return
  }

  // `w3.org` são namespaces de XML, declarados dentro do SVG e do MathML. Eles
  // identificam a linguagem do documento e nunca viram uma requisição.
  const allowed = [
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
    'http://www.w3.org',
    'https://react.dev',
    'https://maze.co',
    'https://snippet.maze.co',
    'https://t.maze.co',
  ]
  const found = new Set()

  bundle.forEach((file) => {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(/(?:https?|wss?):\/\/[a-zA-Z0-9._-]+/g)) {
      found.add(match[0])
    }
  })

  const unexpected = [...found].filter((origin) => (
    !allowed.some((prefix) => origin.startsWith(prefix))
  ))

  assert.deepEqual(unexpected, [])
})

test('a raiz do documento declara a versão do estudo', () => {
  const html = readFileSync('index.html', 'utf8')

  assert.match(html, /data-study-version="maze-v1"/)
  assert.match(html, /data-study-only="true"/)
  assert.match(html, /<title>Draftea Pulse \| Estudio de usabilidad<\/title>/)
})

test('o snippet do Maze só entra com VITE_MAZE_ENABLED', () => {
  const html = readFileSync('index.html', 'utf8')
  const config = readFileSync('vite.config.ts', 'utf8')

  assert.match(html, /MAZE_SNIPPET/)
  assert.match(config, /VITE_MAZE_ENABLED/)

  const bundle = globSync('dist/index.html')
  if (bundle.length === 0) return

  // O build padrão não carrega o snippet: o marcador some e nada entra no lugar.
  assert.doesNotMatch(readFileSync(bundle[0], 'utf8'), /MAZE_SNIPPET/)
})
