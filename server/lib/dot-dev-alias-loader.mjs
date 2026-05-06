import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const loaderDir = path.dirname(fileURLToPath(import.meta.url))

function isDotPackageRoot(directory) {
    if (!directory) {
        return false
    }

    try {
        const packageJson = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf-8'))
        return packageJson?.name === 'dance-of-tal'
            && fs.existsSync(path.join(directory, 'src', 'contracts', 'index.ts'))
    } catch {
        return false
    }
}

export function resolveLocalDotRoot() {
    const candidates = [
        process.env.DOT_STUDIO_DOT_SOURCE_DIR,
        path.resolve(process.cwd(), '..', 'dot'),
        path.resolve(loaderDir, '..', '..', '..', 'dot'),
        path.resolve(loaderDir, '..', '..', '..', '..', 'dot'),
    ]

    return candidates.find(isDotPackageRoot) || null
}

export function resolveLocalDotSpecifier(specifier) {
    const dotRoot = resolveLocalDotRoot()
    if (!dotRoot) {
        return null
    }

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

export async function resolve(specifier, context, nextResolve) {
    const localDotTarget = resolveLocalDotSpecifier(specifier)
    if (localDotTarget && fs.existsSync(localDotTarget)) {
        return {
            url: pathToFileURL(localDotTarget).href,
            shortCircuit: true,
        }
    }

    return nextResolve(specifier, context)
}
