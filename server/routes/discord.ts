import { Hono } from 'hono'
import { discordIntegrationService } from '../services/discord/discord-service.js'
import { jsonError } from './route-errors.js'

const discord = new Hono()

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error)
}

discord.get('/api/discord/status', async (c) => {
    try {
        return c.json(await discordIntegrationService.getStatus())
    } catch (error) {
        return jsonError(c, errorMessage(error), 500)
    }
})

discord.put('/api/discord/config', async (c) => {
    try {
        const body = await c.req.json<{
            enabled?: boolean
            token?: string
            guildId?: string
            clearToken?: boolean
            requireManageGuild?: boolean
            allowedRoleIds?: string[]
            allowedUserIds?: string[]
        }>().catch(() => ({}))
        return c.json(await discordIntegrationService.updateConfig(body))
    } catch (error) {
        return jsonError(c, errorMessage(error), 400)
    }
})

discord.post('/api/discord/disconnect', async (c) => {
    try {
        return c.json(await discordIntegrationService.disconnect())
    } catch (error) {
        return jsonError(c, errorMessage(error), 500)
    }
})

discord.post('/api/discord/sync', async (c) => {
    try {
        const body = await c.req.json<{ workspaceId?: string }>().catch((): { workspaceId?: string } => ({}))
        if (body.workspaceId?.trim()) {
            return c.json(await discordIntegrationService.syncWorkspace(body.workspaceId.trim()))
        }
        return c.json(await discordIntegrationService.syncAllWorkspaces())
    } catch (error) {
        return jsonError(c, errorMessage(error), 400)
    }
})

export default discord
