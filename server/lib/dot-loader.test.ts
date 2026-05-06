import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('resolveDotCommand', () => {
    afterEach(() => {
        vi.unstubAllEnvs()
        vi.resetModules()
    })

    it('uses the sibling ../dot source checkout in dev mode', async () => {
        vi.stubEnv('DOT_STUDIO_PRODUCTION', '0')

        const { resolveDotCommand, resolveLocalDotRoot } = await import('./dot-loader.js')

        expect(resolveLocalDotRoot()).toBe(path.resolve(process.cwd(), '..', 'dot'))
        expect(resolveDotCommand().join(' ')).toContain(path.join('dot', 'src', 'cli', 'dot.ts'))
    })

    it('uses the packaged dance-of-tal command in production mode', async () => {
        vi.stubEnv('DOT_STUDIO_PRODUCTION', '1')

        const { resolveDotCommand, resolveLocalDotRoot } = await import('./dot-loader.js')

        expect(resolveLocalDotRoot()).toBeNull()
        expect(resolveDotCommand().join(' ')).not.toContain(path.join('dot', 'src', 'cli', 'dot.ts'))
    })
})
