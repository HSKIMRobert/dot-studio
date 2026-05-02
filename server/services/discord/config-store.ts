import fs from 'fs/promises'
import path from 'path'
import { STUDIO_DIR } from '../../lib/config.js'

export type DiscordIntegrationConfig = {
    enabled: boolean
    token?: string
    guildId?: string
    requireManageGuild?: boolean
    allowedRoleIds?: string[]
    allowedUserIds?: string[]
}

export type RedactedDiscordIntegrationConfig = {
    enabled: boolean
    hasToken: boolean
    guildId?: string
    requireManageGuild: boolean
    allowedRoleIds: string[]
    allowedUserIds: string[]
}

export type DiscordChannelTarget =
    | {
        kind: 'performer'
        workspaceId: string
        workingDir: string
        performerId: string
        sessionId?: string
    }
    | {
        kind: 'act-thread'
        workspaceId: string
        workingDir: string
        actId: string
        threadId: string
        sessionIds?: Record<string, string>
    }
    | {
        kind: 'menu'
        workspaceId: string
        workingDir: string
    }

export type DiscordWorkspaceMapping = {
    workingDir: string
    categoryId?: string
    menuChannelId?: string
    performerCategories?: Record<string, string>
    actCategories?: Record<string, string>
    performerChannels: Record<string, string>
    performerThreadChannels?: Record<string, string>
    actThreadChannels: Record<string, string>
    backfilledMessageIds?: Record<string, string[]>
}

export type DiscordPendingInteraction = {
    kind: 'permission' | 'question'
    workspaceId: string
    channelId: string
    workingDir: string
    sessionId: string
    request: Record<string, unknown>
}

export type DiscordMappings = {
    version: 1 | 2
    activeWorkspaceId?: string
    activeCategoryId?: string
    archiveCategoryId?: string
    performerCategoryId?: string
    actCategoryId?: string
    menuChannelId?: string
    workspaces: Record<string, DiscordWorkspaceMapping>
    channels: Record<string, DiscordChannelTarget>
    pendingInteractions?: Record<string, DiscordPendingInteraction>
}

const CONFIG_PATH = path.join(STUDIO_DIR, 'discord-config.json')
const MAPPINGS_PATH = path.join(STUDIO_DIR, 'discord-mappings.json')
const PRIVATE_DIR_MODE = 0o700
const PRIVATE_FILE_MODE = 0o600

function normalizeIdList(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return []
    }
    return Array.from(new Set(
        value
            .map((entry) => typeof entry === 'string' ? entry.trim() : '')
            .filter(Boolean),
    ))
}

async function ensurePrivateParent(filePath: string) {
    await fs.mkdir(path.dirname(filePath), { recursive: true, mode: PRIVATE_DIR_MODE })
    await fs.chmod(path.dirname(filePath), PRIVATE_DIR_MODE).catch(() => {})
}

async function writePrivateJson(filePath: string, payload: unknown) {
    await ensurePrivateParent(filePath)
    const stat = await fs.lstat(filePath).catch(() => null)
    if (stat?.isSymbolicLink()) {
        throw new Error(`Refusing to write Discord config through symlink: ${filePath}`)
    }
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
    await fs.writeFile(tempPath, JSON.stringify(payload, null, 2), { encoding: 'utf-8', mode: PRIVATE_FILE_MODE })
    await fs.chmod(tempPath, PRIVATE_FILE_MODE).catch(() => {})
    await fs.rename(tempPath, filePath)
    await fs.chmod(filePath, PRIVATE_FILE_MODE).catch(() => {})
}

export function redactDiscordConfig(config: DiscordIntegrationConfig): RedactedDiscordIntegrationConfig {
    return {
        enabled: config.enabled === true,
        hasToken: !!config.token?.trim(),
        ...(config.guildId?.trim() ? { guildId: config.guildId.trim() } : {}),
        requireManageGuild: config.requireManageGuild !== false,
        allowedRoleIds: normalizeIdList(config.allowedRoleIds),
        allowedUserIds: normalizeIdList(config.allowedUserIds),
    }
}

export async function readDiscordConfig(): Promise<DiscordIntegrationConfig> {
    try {
        const raw = await fs.readFile(CONFIG_PATH, 'utf-8')
        const parsed = JSON.parse(raw) as Partial<DiscordIntegrationConfig>
        return {
            enabled: parsed.enabled === true,
            ...(typeof parsed.token === 'string' && parsed.token.trim() ? { token: parsed.token.trim() } : {}),
            ...(typeof parsed.guildId === 'string' && parsed.guildId.trim() ? { guildId: parsed.guildId.trim() } : {}),
            requireManageGuild: parsed.requireManageGuild !== false,
            allowedRoleIds: normalizeIdList(parsed.allowedRoleIds),
            allowedUserIds: normalizeIdList(parsed.allowedUserIds),
        }
    } catch {
        return { enabled: false, requireManageGuild: true, allowedRoleIds: [], allowedUserIds: [] }
    }
}

export async function writeDiscordConfig(
    patch: {
        enabled?: boolean
        token?: string
        guildId?: string
        clearToken?: boolean
        requireManageGuild?: boolean
        allowedRoleIds?: string[]
        allowedUserIds?: string[]
    },
): Promise<DiscordIntegrationConfig> {
    const current = await readDiscordConfig()
    const next: DiscordIntegrationConfig = {
        ...current,
        ...(typeof patch.enabled === 'boolean' ? { enabled: patch.enabled } : {}),
        ...(typeof patch.requireManageGuild === 'boolean' ? { requireManageGuild: patch.requireManageGuild } : {}),
    }

    if (patch.clearToken) {
        delete next.token
    } else if (typeof patch.token === 'string' && patch.token.trim()) {
        next.token = patch.token.trim()
    }

    if (typeof patch.guildId === 'string') {
        const guildId = patch.guildId.trim()
        if (guildId) {
            next.guildId = guildId
        } else {
            delete next.guildId
        }
    }

    if (Array.isArray(patch.allowedRoleIds)) {
        next.allowedRoleIds = normalizeIdList(patch.allowedRoleIds)
    }
    if (Array.isArray(patch.allowedUserIds)) {
        next.allowedUserIds = normalizeIdList(patch.allowedUserIds)
    }

    next.requireManageGuild = next.requireManageGuild !== false
    next.allowedRoleIds = normalizeIdList(next.allowedRoleIds)
    next.allowedUserIds = normalizeIdList(next.allowedUserIds)

    await writePrivateJson(CONFIG_PATH, next)
    return next
}

export async function readDiscordMappings(): Promise<DiscordMappings> {
    try {
        const raw = await fs.readFile(MAPPINGS_PATH, 'utf-8')
        const parsed = JSON.parse(raw) as Partial<DiscordMappings>
        return {
            version: parsed.version === 2 ? 2 : 1,
            ...(typeof parsed.activeWorkspaceId === 'string' && parsed.activeWorkspaceId ? { activeWorkspaceId: parsed.activeWorkspaceId } : {}),
            ...(typeof parsed.activeCategoryId === 'string' && parsed.activeCategoryId ? { activeCategoryId: parsed.activeCategoryId } : {}),
            ...(typeof parsed.archiveCategoryId === 'string' && parsed.archiveCategoryId ? { archiveCategoryId: parsed.archiveCategoryId } : {}),
            ...(typeof parsed.performerCategoryId === 'string' && parsed.performerCategoryId ? { performerCategoryId: parsed.performerCategoryId } : {}),
            ...(typeof parsed.actCategoryId === 'string' && parsed.actCategoryId ? { actCategoryId: parsed.actCategoryId } : {}),
            ...(typeof parsed.menuChannelId === 'string' && parsed.menuChannelId ? { menuChannelId: parsed.menuChannelId } : {}),
            workspaces: normalizeWorkspaceMappings(parsed.workspaces),
            channels: parsed.channels && typeof parsed.channels === 'object' ? parsed.channels : {},
            pendingInteractions: parsed.pendingInteractions && typeof parsed.pendingInteractions === 'object' ? parsed.pendingInteractions : {},
        }
    } catch {
        return {
            version: 2,
            workspaces: {},
            channels: {},
            pendingInteractions: {},
        }
    }
}

function normalizeWorkspaceMappings(value: unknown): Record<string, DiscordWorkspaceMapping> {
    if (!value || typeof value !== 'object') {
        return {}
    }
    return Object.fromEntries(
        Object.entries(value as Record<string, Partial<DiscordWorkspaceMapping>>).map(([workspaceId, raw]) => {
            const mapping: DiscordWorkspaceMapping = {
                workingDir: typeof raw.workingDir === 'string' ? raw.workingDir : '',
                ...(typeof raw.categoryId === 'string' ? { categoryId: raw.categoryId } : {}),
                ...(typeof raw.menuChannelId === 'string' ? { menuChannelId: raw.menuChannelId } : {}),
                performerCategories: raw.performerCategories && typeof raw.performerCategories === 'object' ? raw.performerCategories : {},
                actCategories: raw.actCategories && typeof raw.actCategories === 'object' ? raw.actCategories : {},
                performerChannels: raw.performerChannels && typeof raw.performerChannels === 'object' ? raw.performerChannels : {},
                performerThreadChannels: raw.performerThreadChannels && typeof raw.performerThreadChannels === 'object' ? raw.performerThreadChannels : {},
                actThreadChannels: raw.actThreadChannels && typeof raw.actThreadChannels === 'object' ? raw.actThreadChannels : {},
                backfilledMessageIds: raw.backfilledMessageIds && typeof raw.backfilledMessageIds === 'object' ? raw.backfilledMessageIds : {},
            }
            return [workspaceId, mapping]
        }),
    )
}

export async function writeDiscordMappings(mappings: DiscordMappings) {
    await writePrivateJson(MAPPINGS_PATH, mappings)
}

export async function updateDiscordMappings(updater: (current: DiscordMappings) => DiscordMappings | void | Promise<DiscordMappings | void>) {
    const current = await readDiscordMappings()
    const updated = (await updater(current)) || current
    await writeDiscordMappings(updated)
    return updated
}

export function getOrCreateWorkspaceMapping(
    mappings: DiscordMappings,
    workspaceId: string,
    workingDir: string,
): DiscordWorkspaceMapping {
    const existing = mappings.workspaces[workspaceId]
    if (existing) {
        existing.workingDir = workingDir
        existing.performerCategories ||= {}
        existing.actCategories ||= {}
        existing.performerChannels ||= {}
        existing.performerThreadChannels ||= {}
        existing.actThreadChannels ||= {}
        existing.backfilledMessageIds ||= {}
        delete (existing as { actThreadControlMessages?: unknown }).actThreadControlMessages
        delete (existing as { participantRoles?: unknown }).participantRoles
        return existing
    }

    const created: DiscordWorkspaceMapping = {
        workingDir,
        performerCategories: {},
        actCategories: {},
        performerChannels: {},
        performerThreadChannels: {},
        actThreadChannels: {},
        backfilledMessageIds: {},
    }
    mappings.workspaces[workspaceId] = created
    return created
}
