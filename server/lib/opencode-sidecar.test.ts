import { afterEach, describe, expect, it, vi } from 'vitest'

describe('isOpencodeReachable', () => {
    afterEach(() => {
        vi.unstubAllEnvs()
        vi.unstubAllGlobals()
        vi.resetModules()
    })

    it('checks the OpenCode global health endpoint for sidecar readiness', async () => {
        const fetchMock = vi.fn(async () => ({ ok: true }) as Response)
        vi.stubEnv('OPENCODE_PORT', '43155')
        vi.stubGlobal('fetch', fetchMock)

        const { isOpencodeReachable } = await import('./opencode-sidecar.js')

        await expect(isOpencodeReachable()).resolves.toBe(true)
        const firstCall = fetchMock.mock.calls[0] as unknown[] | undefined
        expect(String(firstCall?.[0])).toBe('http://localhost:43155/global/health')
    })
})
