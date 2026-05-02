const DISCORD_NAME_MAX = 90

function compactWhitespace(value: string) {
    return value.replace(/\s+/g, ' ').trim()
}

function basename(workingDir: string) {
    const normalized = workingDir.trim().replace(/[\\/]+$/, '')
    return normalized.split(/[/\\]/).pop() || 'workspace'
}

export function sanitizeDiscordName(value: string, fallback = 'item') {
    const normalized = compactWhitespace(value)
        .toLowerCase()
        .replace(/['"]/g, '')
        .replace(/[^a-z0-9가-힣._ -]+/g, '-')
        .replace(/\s+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^[-._]+|[-._]+$/g, '')
    const name = normalized || fallback
    return name.slice(0, DISCORD_NAME_MAX)
}

export function workspaceCategoryName(workingDir: string) {
    return compactWhitespace(basename(workingDir)).slice(0, 70)
}

export function archiveCategoryName() {
    return 'archived'
}

export function controlChannelName() {
    return 'studio-control'
}

export function entityCategoryName(name: string, fallback = 'studio') {
    return compactWhitespace(name || fallback).slice(0, DISCORD_NAME_MAX) || fallback
}

export function performerCategoryName(name: string) {
    return `👤 ${entityCategoryName(name, 'performer')}`.slice(0, DISCORD_NAME_MAX)
}

export function actCategoryName(name: string) {
    return `👥 ${entityCategoryName(name, 'act')}`.slice(0, DISCORD_NAME_MAX)
}

export function threadChannelName(name: string | undefined, threadId: string) {
    return sanitizeDiscordName(name || `thread-${threadId.slice(0, 6)}`, 'thread')
}

export function performerChannelName(name: string) {
    return sanitizeDiscordName(name, 'performer')
}

export function actThreadChannelName(actName: string, threadName?: string) {
    return threadChannelName(threadName, actName)
}

export function actThreadMappingKey(actId: string, threadId: string) {
    return `${actId}:${threadId}`
}

export function performerThreadMappingKey(performerId: string, sessionId: string) {
    return `${performerId}:${sessionId}`
}
