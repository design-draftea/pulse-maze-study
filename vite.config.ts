import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const MAZE_MARKER = /^[ \t]*<!--\s*\n\s*MAZE_SNIPPET[\s\S]*?-->[ \t]*\n/m

/**
 * Injeta o snippet oficial do Maze no `index.html`.
 *
 * O snippet é único por conta do Maze e não é inventado aqui: o plugin apenas
 * copia, sem alterar, o conteúdo de `maze/snippet.html`. Quando
 * `VITE_MAZE_ENABLED` não está ativo o marcador é removido e o build fica sem
 * nenhuma requisição externa — que é o que os testes de isolamento verificam.
 */
const mazeSnippet = (): Plugin => ({
  name: 'pulse-study-maze-snippet',
  transformIndexHtml: {
    order: 'pre',
    handler(html) {
      if (process.env.VITE_MAZE_ENABLED !== 'true') {
        return html.replace(MAZE_MARKER, '')
      }

      const snippetPath = resolve(
        process.cwd(),
        process.env.MAZE_SNIPPET_PATH || 'maze/snippet.html',
      )
      const snippet = readFileSync(snippetPath, 'utf8').trim()

      if (snippet.length === 0) {
        throw new Error(
          `VITE_MAZE_ENABLED=true mas ${snippetPath} está vazio. `
          + 'Cole o snippet oficial do Maze antes de publicar a coleta.',
        )
      }

      return html.replace(MAZE_MARKER, `${snippet}\n`)
    },
  },
})

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), mazeSnippet()],
})
