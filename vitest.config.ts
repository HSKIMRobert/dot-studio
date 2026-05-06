import { defineConfig } from 'vitest/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const localDotRoot = path.resolve(rootDir, '..', 'dot')

function localDotTarget(specifier: string) {
    if (!fs.existsSync(path.join(localDotRoot, 'package.json'))) {
        return null
    }

    if (specifier === 'dance-of-tal/contracts') {
        return path.join(localDotRoot, 'src', 'contracts', 'index.ts')
    }

    if (specifier === 'dance-of-tal/data/types') {
        return path.join(localDotRoot, 'src', 'data', 'types.ts')
    }

    const libMatch = specifier.match(/^dance-of-tal\/lib\/([^/]+)$/)
    if (libMatch) {
        return path.join(localDotRoot, 'src', 'lib', `${libMatch[1]}.ts`)
    }

    return null
}

function localDotAliasPlugin() {
    return {
        name: 'dot-studio-vitest-local-dot-alias',
        enforce: 'pre' as const,
        resolveId(source: string) {
            const target = localDotTarget(source)
            return target && fs.existsSync(target) ? target : null
        },
    }
}

export default defineConfig({
    plugins: [localDotAliasPlugin()],
    test: {
        include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
    },
    resolve: {
        alias: {
            '@': '/src',
        },
    },
})
