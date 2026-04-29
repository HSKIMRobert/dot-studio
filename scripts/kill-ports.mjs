import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const ports = process.argv.slice(2)

async function killPid(pid) {
    if (!pid || pid === String(process.pid)) return

    if (process.platform === 'win32') {
        await execFileAsync('taskkill.exe', ['/PID', pid, '/T', '/F']).catch(() => {})
        return
    }

    try {
        process.kill(Number(pid), 'SIGKILL')
    } catch {
        // The port may have been released by another process.
    }
}

async function findWindowsPids(targetPorts) {
    const { stdout } = await execFileAsync('netstat.exe', ['-ano', '-p', 'tcp'])
    const wanted = new Set(targetPorts.map(String))
    const pids = new Set()

    for (const line of stdout.split(/\r?\n/)) {
        const parts = line.trim().split(/\s+/)
        if (parts.length < 5 || parts[0] !== 'TCP') continue
        const localAddress = parts[1]
        const state = parts[3]
        const pid = parts[4]
        const port = localAddress.match(/:(\d+)$/)?.[1]
        if (state === 'LISTENING' && port && wanted.has(port)) {
            pids.add(pid)
        }
    }

    return [...pids]
}

async function findUnixPids(targetPorts) {
    const args = targetPorts.map((port) => `-i:${port}`)
    const { stdout } = await execFileAsync('lsof', ['-ti', ...args])
    return [...new Set(stdout.split(/\s+/).filter(Boolean))]
}

if (ports.length === 0) {
    process.exit(0)
}

const pids = process.platform === 'win32'
    ? await findWindowsPids(ports).catch(() => [])
    : await findUnixPids(ports).catch(() => [])

await Promise.all(pids.map(killPid))
