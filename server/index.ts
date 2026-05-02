// DOT Studio — Hono API Server (Entry Point)

import { serve } from '@hono/node-server'
import { setupTerminalWs } from './terminal.js'
import { createServerApp } from './app.js'
import { refreshAssistantProjectionOnServerStartup } from './services/studio-assistant/assistant-startup-service.js'

// Config
import { PORT, OPENCODE_URL, STUDIO_DIR, IS_PRODUCTION, getActiveProjectDir } from './lib/config.js'
import { ensureOpencodeSidecar } from './lib/opencode-sidecar.js'
import { discordIntegrationService } from './services/discord/discord-service.js'

const app = createServerApp()

// ── Start Server ────────────────────────────────────────
await ensureOpencodeSidecar().catch((err) => {
    console.warn(`OpenCode sidecar is not ready yet: ${err instanceof Error ? err.message : String(err)}`)
})
await refreshAssistantProjectionOnServerStartup().catch((err) => {
    console.warn(`Studio Assistant projection refresh failed on startup: ${err instanceof Error ? err.message : String(err)}`)
})
await discordIntegrationService.initialize().catch((err) => {
    console.warn(`Discord integration startup failed: ${err instanceof Error ? err.message : String(err)}`)
})

console.log(`\n🎪 DOT Studio Server${IS_PRODUCTION ? ' (production)' : ' (dev)'}`)
console.log(`   API:      http://localhost:${PORT}`)
console.log(`   OpenCode: ${OPENCODE_URL} (managed sidecar)`)
console.log(`   Project:  ${getActiveProjectDir()}`)
console.log(`   Data:     ${STUDIO_DIR}\n`)

const server = serve({ fetch: app.fetch, port: PORT })
setupTerminalWs(server as unknown as Parameters<typeof setupTerminalWs>[0], () => getActiveProjectDir())
