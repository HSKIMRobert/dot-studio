import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let tempDir = ''

async function importStore() {
    vi.resetModules()
    process.env.STUDIO_DIR = tempDir
    return import('./config-store.js')
}

beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dot-discord-test-'))
})

afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
    delete process.env.STUDIO_DIR
})

describe('discord config store', () => {
    it('redacts saved tokens from API-facing config', async () => {
        const store = await importStore()
        const saved = await store.writeDiscordConfig({
            enabled: true,
            token: 'secret-token',
            guildId: 'guild-1',
        })

        expect(store.redactDiscordConfig(saved)).toEqual({
            enabled: true,
            hasToken: true,
            guildId: 'guild-1',
            requireManageGuild: true,
            allowedRoleIds: [],
            allowedUserIds: [],
        })
    })

    it('preserves write-only token when updating other fields', async () => {
        const store = await importStore()
        await store.writeDiscordConfig({ enabled: true, token: 'secret-token' })
        const saved = await store.writeDiscordConfig({ guildId: 'guild-2' })

        expect(saved.token).toBe('secret-token')
        expect(saved.guildId).toBe('guild-2')
    })

    it('writes config and mappings with private file permissions', async () => {
        const store = await importStore()
        await store.writeDiscordConfig({ enabled: true, token: 'secret-token' })
        await store.writeDiscordMappings({ version: 1, workspaces: {}, channels: {} })

        const configStat = await fs.stat(path.join(tempDir, 'discord-config.json'))
        const mappingStat = await fs.stat(path.join(tempDir, 'discord-mappings.json'))

        expect(configStat.mode & 0o777).toBe(0o600)
        expect(mappingStat.mode & 0o777).toBe(0o600)
    })

    it('reads v1 mappings with v2 active-workspace fields defaulted safely', async () => {
        const store = await importStore()
        await fs.writeFile(path.join(tempDir, 'discord-mappings.json'), JSON.stringify({
            version: 1,
            workspaces: {
                'workspace-1': {
                    workingDir: '/tmp/workspace-1',
                    performerChannels: {},
                    actThreadChannels: {},
                    participantRoles: {},
                },
            },
            channels: {},
            roles: {},
        }), 'utf-8')

        const mappings = await store.readDiscordMappings()

        expect(mappings.version).toBe(1)
        expect(mappings.activeWorkspaceId).toBeUndefined()
        expect(mappings.archiveCategoryId).toBeUndefined()
        expect(mappings.performerCategoryId).toBeUndefined()
        expect(mappings.actCategoryId).toBeUndefined()
        expect(mappings.workspaces['workspace-1'].backfilledMessageIds).toEqual({})
        expect('participantRoles' in mappings.workspaces['workspace-1']).toBe(false)
        expect('roles' in mappings).toBe(false)
    })
})
