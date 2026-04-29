import { describe, expect, it } from 'vitest'
import { toProjectionPath } from './projection-manifest.js'

describe('projection path normalization', () => {
    it('uses forward slashes for OpenCode agent and manifest paths', () => {
        expect(toProjectionPath('dot-studio\\workspace\\hash\\performer--build')).toBe('dot-studio/workspace/hash/performer--build')
        expect(toProjectionPath('.opencode\\agents\\dot-studio\\workspace\\hash\\performer--build.md')).toBe('.opencode/agents/dot-studio/workspace/hash/performer--build.md')
    })
})
