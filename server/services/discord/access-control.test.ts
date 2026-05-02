import { describe, expect, it } from 'vitest'
import { isDiscordActorAuthorized, summarizeDiscordAccess } from './access-control.js'

describe('discord access control', () => {
    it('defaults to requiring Manage Server permission', () => {
        expect(isDiscordActorAuthorized({}, {
            userId: 'user-1',
            roleIds: [],
            canManageGuild: false,
        })).toBe(false)
        expect(isDiscordActorAuthorized({}, {
            userId: 'user-1',
            roleIds: [],
            canManageGuild: true,
        })).toBe(true)
    })

    it('allows configured role and user exceptions', () => {
        expect(isDiscordActorAuthorized({ allowedRoleIds: ['role-1'] }, {
            userId: 'user-1',
            roleIds: ['role-1'],
            canManageGuild: false,
        })).toBe(true)
        expect(isDiscordActorAuthorized({ allowedUserIds: ['user-2'] }, {
            userId: 'user-2',
            roleIds: [],
            canManageGuild: false,
        })).toBe(true)
    })

    it('can summarize access settings without exposing raw ids', () => {
        expect(summarizeDiscordAccess({
            requireManageGuild: false,
            allowedRoleIds: ['role-1', 'role-2'],
            allowedUserIds: ['user-1'],
        })).toEqual({
            requireManageGuild: false,
            allowedRoleCount: 2,
            allowedUserCount: 1,
        })
    })
})
