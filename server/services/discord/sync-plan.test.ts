import { describe, expect, it } from 'vitest'
import {
    actCategoryName,
    actThreadChannelName,
    actThreadMappingKey,
    archiveCategoryName,
    controlChannelName,
    entityCategoryName,
    performerChannelName,
    performerCategoryName,
    performerThreadMappingKey,
    sanitizeDiscordName,
    threadChannelName,
    workspaceCategoryName,
} from './sync-plan.js'

describe('discord sync plan helpers', () => {
    it('normalizes Discord channel names without losing useful labels', () => {
        expect(sanitizeDiscordName('Research Lead!!')).toBe('research-lead')
        expect(performerChannelName('Code Reviewer')).toBe('code-reviewer')
        expect(threadChannelName('First Thread', 'thread-123456')).toBe('first-thread')
        expect(threadChannelName(undefined, 'thread-123456')).toBe('thread-thread')
        expect(actThreadChannelName('Review Act', 'First Thread')).toBe('first-thread')
        expect(entityCategoryName('Review Act')).toBe('Review Act')
        expect(performerCategoryName('Code Reviewer')).toBe('👤 Code Reviewer')
        expect(actCategoryName('Review Act')).toBe('👥 Review Act')
    })

    it('builds stable mapping keys', () => {
        expect(actThreadMappingKey('act-1', 'thread-1')).toBe('act-1:thread-1')
        expect(performerThreadMappingKey('performer-1', 'session-1')).toBe('performer-1:session-1')
    })

    it('keeps workspace categories human-readable', () => {
        expect(workspaceCategoryName('/tmp/dance-workspace')).toBe('dance-workspace')
        expect(archiveCategoryName()).toBe('archived')
        expect(controlChannelName()).toBe('studio-control')
    })
})
