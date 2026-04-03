import build from '@hono/vite-build/cloudflare-pages'
import devServer from '@hono/vite-dev-server'
import adapter from '@hono/vite-dev-server/cloudflare'
import { defineConfig } from 'vite'
import fs from 'fs'
import path from 'path'

// Plugin to inline HTML file as a virtual module
function inlineHtmlPlugin() {
  return {
    name: 'inline-html',
    resolveId(id: string) {
      if (id === 'virtual:index-html') return '\0virtual:index-html'
    },
    load(id: string) {
      if (id === '\0virtual:index-html') {
        const htmlPath = path.resolve(__dirname, 'public/index.html')
        const content = fs.readFileSync(htmlPath, 'utf-8')
        return `export default ${JSON.stringify(content)}`
      }
    }
  }
}

export default defineConfig({
  plugins: [
    inlineHtmlPlugin(),
    build(),
    devServer({
      adapter,
      entry: 'src/index.tsx'
    })
  ],
  build: {
    outDir: 'dist'
  }
})
