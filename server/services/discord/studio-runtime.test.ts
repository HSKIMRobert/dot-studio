import { describe, expect, it } from 'vitest'
import { formatDiscordBackfillMessages } from './studio-runtime.js'

describe('formatDiscordBackfillMessages', () => {
    it('keeps recent text-only user and assistant messages with role labels', () => {
        const messages = formatDiscordBackfillMessages({
            sessionId: 'session-1',
            assistantLabel: 'Planner',
            limit: 2,
            messages: [
                { id: 'system-1', role: 'system', content: 'hidden' },
                { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Plan this.' }] },
                { id: 'tool-1', role: 'assistant', parts: [{ type: 'tool', text: 'raw tool output' }] },
                { id: 'assistant-1', role: 'assistant', parts: [{ type: 'text', text: 'Here is a plan.' }] },
                { id: 'user-2', info: { role: 'user' }, content: 'Revise it.' },
            ],
        })

        expect(messages).toEqual([
            { id: 'session-1:assistant-1', content: '**[Planner]**\nHere is a plan.' },
            { id: 'session-1:user-2', content: '**[Studio User]**\nRevise it.' },
        ])
    })

    it('skips already backfilled message ids', () => {
        const messages = formatDiscordBackfillMessages({
            sessionId: 'session-1',
            assistantLabel: 'Planner',
            knownMessageIds: ['session-1:user-1'],
            messages: [
                { id: 'user-1', role: 'user', content: 'Already sent.' },
                { id: 'assistant-1', role: 'assistant', content: 'New response.' },
            ],
        })

        expect(messages).toEqual([
            { id: 'session-1:assistant-1', content: '**[Planner]**\nNew response.' },
        ])
    })

    it('can hide user messages for Act participant history sync', () => {
        const messages = formatDiscordBackfillMessages({
            sessionId: 'session-1',
            assistantLabel: 'Reviewer',
            includeUserMessages: false,
            messages: [
                { id: 'user-1', role: 'user', content: '[Direct Message]\nfrom teammate' },
                { id: 'assistant-1', role: 'assistant', content: 'I reviewed the draft.' },
            ],
        })

        expect(messages).toEqual([
            { id: 'session-1:assistant-1', content: '**[Reviewer]**\nI reviewed the draft.' },
        ])
    })
})
