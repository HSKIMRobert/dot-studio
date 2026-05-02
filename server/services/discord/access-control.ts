export type DiscordAccessConfig = {
    requireManageGuild?: boolean
    allowedRoleIds?: string[]
    allowedUserIds?: string[]
}

export type DiscordActorAccess = {
    userId: string
    roleIds: string[]
    canManageGuild: boolean
}

function normalizeIds(values: string[] | undefined) {
    return new Set((values || []).map((value) => value.trim()).filter(Boolean))
}

export function isDiscordActorAuthorized(
    config: DiscordAccessConfig,
    actor: DiscordActorAccess,
) {
    const allowedUserIds = normalizeIds(config.allowedUserIds)
    if (allowedUserIds.has(actor.userId)) {
        return true
    }

    const allowedRoleIds = normalizeIds(config.allowedRoleIds)
    if (actor.roleIds.some((roleId) => allowedRoleIds.has(roleId))) {
        return true
    }

    return config.requireManageGuild !== false && actor.canManageGuild
}

export function summarizeDiscordAccess(config: DiscordAccessConfig) {
    const allowedRoleCount = normalizeIds(config.allowedRoleIds).size
    const allowedUserCount = normalizeIds(config.allowedUserIds).size
    return {
        requireManageGuild: config.requireManageGuild !== false,
        allowedRoleCount,
        allowedUserCount,
    }
}
