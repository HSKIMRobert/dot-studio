import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { STUDIO_API_PORT, STUDIO_VITE_PORT } from './shared/default-ports.js'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

function isDotPackageRoot(directory: string | undefined) {
  if (!directory) {
    return false
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf-8')) as { name?: string }
    return packageJson.name === 'dance-of-tal'
      && fs.existsSync(path.join(directory, 'src', 'contracts', 'index.ts'))
  } catch {
    return false
  }
}

function resolveLocalDotRoot() {
  const candidates = [
    process.env.DOT_STUDIO_DOT_SOURCE_DIR,
    path.resolve(rootDir, '..', 'dot'),
  ]

  return candidates.find(isDotPackageRoot) || null
}

function resolveLocalDotSpecifier(specifier: string, dotRoot: string) {
  if (specifier === 'dance-of-tal/contracts') {
    return path.join(dotRoot, 'src', 'contracts', 'index.ts')
  }

  if (specifier === 'dance-of-tal/data/types') {
    return path.join(dotRoot, 'src', 'data', 'types.ts')
  }

  const libMatch = specifier.match(/^dance-of-tal\/lib\/([^/]+)$/)
  if (libMatch) {
    return path.join(dotRoot, 'src', 'lib', `${libMatch[1]}.ts`)
  }

  return null
}

function localDotAliasPlugin(enabled: boolean) {
  const dotRoot = enabled ? resolveLocalDotRoot() : null

  return {
    name: 'dot-studio-local-dot-dev-alias',
    enforce: 'pre' as const,
    resolveId(source: string) {
      if (!dotRoot) {
        return null
      }

      const localDotTarget = resolveLocalDotSpecifier(source, dotRoot)
      return localDotTarget && fs.existsSync(localDotTarget) ? localDotTarget : null
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const localDotRoot = command === 'serve' ? resolveLocalDotRoot() : null

  return {
    plugins: [localDotAliasPlugin(command === 'serve'), react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return undefined
            }

            if (id.includes('@xyflow/react')) {
              return 'flow-vendor'
            }

            if (id.includes('@dnd-kit/')) {
              return 'dnd-vendor'
            }

            if (id.includes('@tanstack/react-query')) {
              return 'query-vendor'
            }

            if (id.includes('@xterm/')) {
              return 'terminal-vendor'
            }

            if (
              id.includes('react-markdown') ||
              id.includes('remark-gfm') ||
              id.includes('rehype-highlight') ||
              id.includes('highlight.js')
            ) {
              return 'markdown-vendor'
            }

            if (id.includes('@opencode-ai/sdk') || id.includes('opencode-ai')) {
              return 'opencode-vendor'
            }

            if (id.includes('elkjs')) {
              return 'graph-vendor'
            }

            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('scheduler')
            ) {
              return 'react-vendor'
            }

            if (id.includes('lucide-react')) {
              return 'icon-vendor'
            }

            return undefined
          },
        },
      },
    },
    server: {
      port: STUDIO_VITE_PORT,
      fs: {
        allow: [
          rootDir,
          ...(localDotRoot ? [localDotRoot] : []),
        ],
      },
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${STUDIO_API_PORT}`,
          changeOrigin: true,
        },
        '/ws': {
          target: `ws://127.0.0.1:${STUDIO_API_PORT}`,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  }
})
