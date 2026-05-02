import { fetchJSON, postJSON, putJSON } from '../api-core'

export type DiscordIntegrationStatus = {
    config: {
        enabled: boolean
        hasToken: boolean
        guildId?: string
        requireManageGuild: boolean
        allowedRoleIds: string[]
        allowedUserIds: string[]
    }
    online: boolean
    botUser?: { id: string; username: string }
    applicationId?: string
    inviteUrl?: string
    guilds: Array<{ id: string; name: string }>
    selectedGuild?: { id: string; name: string }
    missingPermissions: string[]
    messageContentLikelyMissing: boolean
    access: {
        requireManageGuild: boolean
        allowedRoleCount: number
        allowedUserCount: number
    }
    lastError?: string
}

export const discordApi = {
    status: () => fetchJSON<DiscordIntegrationStatus>('/api/discord/status'),
    updateConfig: (body: {
        enabled?: boolean
        token?: string
        guildId?: string
        clearToken?: boolean
        requireManageGuild?: boolean
        allowedRoleIds?: string[]
        allowedUserIds?: string[]
    }) => putJSON<DiscordIntegrationStatus>('/api/discord/config', body),
    disconnect: () => postJSON<DiscordIntegrationStatus>('/api/discord/disconnect'),
    sync: (workspaceId?: string | null) =>
        postJSON<{
            ok: true
            workspaceId?: string
            syncedWorkspaces?: number
            failedWorkspaces?: Array<{ workspaceId: string; workingDir: string; error: string }>
            categoryId?: string
            menuChannelId?: string
        }>(
            '/api/discord/sync',
            workspaceId ? { workspaceId } : {},
        ),
}
