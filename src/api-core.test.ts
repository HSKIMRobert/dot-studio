import { afterEach, describe, expect, it } from 'vitest'
import {
    absolutizeWorkspacePath,
    normalizeWorkspaceFileEntry,
    setApiWorkingDirContext,
} from './api-core'

describe('api path helpers', () => {
    afterEach(() => {
        setApiWorkingDirContext(null)
    })

    it('preserves Windows absolute paths', () => {
        expect(absolutizeWorkspacePath('C:\\Users\\juno\\project\\file.ts', 'C:\\Users\\juno\\project')).toBe('C:\\Users\\juno\\project\\file.ts')
    })

    it('joins relative paths with Windows workspace separators', () => {
        expect(absolutizeWorkspacePath('src\\file.ts', 'C:\\Users\\juno\\project\\')).toBe('C:\\Users\\juno\\project\\src\\file.ts')
    })

    it('extracts filenames from either slash style', () => {
        setApiWorkingDirContext('C:\\Users\\juno\\project')

        expect(normalizeWorkspaceFileEntry('src\\file.ts')).toMatchObject({
            name: 'file.ts',
            absolute: 'C:\\Users\\juno\\project\\src\\file.ts',
        })
    })
})
