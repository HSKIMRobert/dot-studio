import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const subscribeMock = vi.fn()
const respondPermissionMock = vi.fn()

vi.mock('../lib/opencode.js', () => ({
    getOpencode: async () => ({
        event: {
            subscribe: subscribeMock,
        },
        permission: {
            respond: respondPermissionMock,
        },
    }),
}))

type SubscribeOptions = {
    signal: AbortSignal
    sseMaxRetryAttempts?: number
}

function blockingStream(signal: AbortSignal): AsyncIterable<never> {
    return {
        [Symbol.asyncIterator]() {
            return {
                async next() {
                    if (signal.aborted) {
                        return { done: true, value: undefined }
                    }
                    await new Promise<void>((resolve) => {
                        signal.addEventListener('abort', () => resolve(), { once: true })
                    })
                    return { done: true, value: undefined }
                },
                async return() {
                    return { done: true, value: undefined }
                },
            }
        },
    }
}

function completedStream(): AsyncIterable<never> {
    return {
        [Symbol.asyncIterator]() {
            return {
                async next() {
                    return { done: true, value: undefined }
                },
            }
        },
    }
}

function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('buildStudioChatEventStream', () => {
    beforeEach(() => {
        vi.resetModules()
        vi.useRealTimers()
        subscribeMock.mockReset()
        respondPermissionMock.mockReset()
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.clearAllMocks()
    })

    it('subscribes to OpenCode events with an isolated abort signal', async () => {
        const subscribeOptions: SubscribeOptions[] = []
        subscribeMock.mockImplementation(async (_parameters, options: SubscribeOptions) => {
            subscribeOptions.push(options)
            return { stream: blockingStream(options.signal) }
        })

        const requestController = new AbortController()
        const { buildStudioChatEventStream } = await import('./chat-event-stream-service.js')

        const stream = await buildStudioChatEventStream('/tmp/studio-workspace', requestController.signal)

        await vi.waitFor(() => expect(subscribeMock).toHaveBeenCalledTimes(1))

        expect(subscribeOptions[0]?.signal).toBeInstanceOf(AbortSignal)
        expect(subscribeOptions[0]?.signal).not.toBe(requestController.signal)
        expect(subscribeOptions[0]?.signal.aborted).toBe(false)
        expect(subscribeOptions[0]?.sseMaxRetryAttempts).toBe(1)

        await stream.cancel()

        expect(subscribeOptions[0]?.signal.aborted).toBe(true)
    })

    it('aborts active OpenCode subscriptions when the request aborts', async () => {
        const subscribeOptions: SubscribeOptions[] = []
        subscribeMock.mockImplementation(async (_parameters, options: SubscribeOptions) => {
            subscribeOptions.push(options)
            return { stream: blockingStream(options.signal) }
        })

        const requestController = new AbortController()
        const { buildStudioChatEventStream } = await import('./chat-event-stream-service.js')

        const stream = await buildStudioChatEventStream('/tmp/studio-workspace', requestController.signal)

        await vi.waitFor(() => expect(subscribeMock).toHaveBeenCalledTimes(1))

        requestController.abort()

        await vi.waitFor(() => expect(subscribeOptions[0]?.signal.aborted).toBe(true))
        await stream.cancel().catch(() => {})
    })

    it('does not start an OpenCode subscription for an already-aborted request', async () => {
        const requestController = new AbortController()
        requestController.abort()

        const { buildStudioChatEventStream } = await import('./chat-event-stream-service.js')

        const stream = await buildStudioChatEventStream('/tmp/studio-workspace', requestController.signal)

        await wait(25)

        expect(subscribeMock).not.toHaveBeenCalled()

        await stream.cancel().catch(() => {})
    })

    it('waits for the refresh loop instead of recursively reconnecting completed subscriptions', async () => {
        subscribeMock.mockResolvedValue({ stream: completedStream() })

        const { buildStudioChatEventStream } = await import('./chat-event-stream-service.js')
        const stream = await buildStudioChatEventStream('/tmp/studio-workspace')

        await vi.waitFor(() => expect(subscribeMock).toHaveBeenCalledTimes(1))
        await wait(25)

        expect(subscribeMock).toHaveBeenCalledTimes(1)

        await stream.cancel()
    })
})
