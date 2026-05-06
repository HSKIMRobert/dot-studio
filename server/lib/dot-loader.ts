import path from 'path'
import fs from 'fs'
import { createHash } from 'crypto'
import { fileURLToPath } from 'url'
import { getOpencode } from './opencode.js'
import { unwrapOpencodeResult } from './opencode-errors.js'
import { DEFAULT_PROJECT_DIR, IS_PRODUCTION } from './config.js'
import { resolvePackageBin, resolvePackageBinCommand } from './package-bin.js'
import type { McpLiveStatusMap } from './mcp-catalog.js'

type McpAddConfig = {
    type: 'local'
    command: string[]
    enabled?: boolean
    environment?: Record<string, string>
}

export const CAPABILITY_LOADER_TOOL_NAME = 'load_capability_context'
const __dirname = path.dirname(fileURLToPath(import.meta.url))

function isDotPackageRoot(directory: string | null | undefined) {
    if (!directory) {
        return false
    }

    try {
        const packageJson = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf-8')) as { name?: string }
        return packageJson.name === 'dance-of-tal'
            && fs.existsSync(path.join(directory, 'src', 'cli', 'dot.ts'))
    } catch {
        return false
    }
}

export function resolveLocalDotRoot() {
    if (IS_PRODUCTION) {
        return null
    }

    const candidates = [
        process.env.DOT_STUDIO_DOT_SOURCE_DIR,
        path.resolve(process.cwd(), '..', 'dot'),
        path.resolve(DEFAULT_PROJECT_DIR, 'dot'),
        path.resolve(__dirname, '..', '..', '..', 'dot'),
        path.resolve(__dirname, '..', '..', '..', '..', 'dot'),
    ]

    return candidates.find(isDotPackageRoot) || null
}

export function resolveDotCommand(): string[] {
    const localDotRoot = resolveLocalDotRoot()
    if (localDotRoot) {
        const tsxCommand = resolvePackageBinCommand('tsx', 'tsx')
        const dotCliPath = path.join(localDotRoot, 'src', 'cli', 'dot.ts')
        if (tsxCommand) {
            return [tsxCommand.command, ...tsxCommand.args, dotCliPath]
        }
    }

    return [resolvePackageBin('dance-of-tal', 'dance-of-tal') || 'dance-of-tal']
}

export function dotLoaderServerName(cwd: string): string {
    const hash = createHash('sha1').update(path.resolve(cwd)).digest('hex').slice(0, 10)
    return `dot-stage-${hash}`
}

function resolveCapabilityToolId(toolIds: string[]) {
    const exact = toolIds.find((toolId) => toolId === CAPABILITY_LOADER_TOOL_NAME)
    if (exact) {
        return exact
    }

    return toolIds.find((toolId) => (
        toolId.endsWith(`/${CAPABILITY_LOADER_TOOL_NAME}`)
        || toolId.endsWith(`:${CAPABILITY_LOADER_TOOL_NAME}`)
        || toolId.endsWith(`.${CAPABILITY_LOADER_TOOL_NAME}`)
    )) || null
}

export async function ensureDotLoaderServer(cwd: string): Promise<{
    available: boolean
    serverName: string
    toolName: string
}> {
    const serverName = dotLoaderServerName(cwd)
    const oc = await getOpencode()
    const params = { directory: path.resolve(cwd) }
    const statusData = unwrapOpencodeResult<McpLiveStatusMap>(await oc.mcp.status(params)) || {}
    const existing = statusData[serverName]

    if (!existing) {
        const config = {
            type: 'local',
            command: resolveDotCommand(),
            enabled: true,
            environment: {
                DANCE_OF_TAL_PROJECT_DIR: path.resolve(cwd),
            },
        } as unknown as McpAddConfig
        unwrapOpencodeResult(await oc.mcp.add({
            ...params,
            name: serverName,
            config,
        }))
    }

    const refreshedStatusData = unwrapOpencodeResult<McpLiveStatusMap>(await oc.mcp.status(params)) || {}
    const status = refreshedStatusData[serverName]

    if (!status || status.status !== 'connected') {
        unwrapOpencodeResult(await oc.mcp.connect({
            name: serverName,
            ...params,
        }))
    }

    const toolIds = unwrapOpencodeResult<string[]>(await oc.tool.ids(params)) || []
    const resolvedToolId = resolveCapabilityToolId(toolIds)
    if (!resolvedToolId) {
        throw new Error(`Capability loader tool '${CAPABILITY_LOADER_TOOL_NAME}' is unavailable after MCP connection.`)
    }

    return {
        available: true,
        serverName,
        toolName: resolvedToolId,
    }
}
