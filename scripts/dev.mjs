import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDirectory = dirname(dirname(fileURLToPath(import.meta.url)))
const frontendDirectory = join(rootDirectory, 'frontend')
const isWindows = process.platform === 'win32'
const host = process.env.FRAME2D_HOST ?? '127.0.0.1'
const apiPort = process.env.FRAME2D_API_PORT ?? '8000'
const frontendPort = process.env.FRAME2D_FRONTEND_PORT ?? '5173'
const virtualEnvironmentPython = join(
  rootDirectory,
  '.venv',
  isWindows ? 'Scripts/python.exe' : 'bin/python',
)
const python = process.env.FRAME2D_PYTHON
  ?? (existsSync(virtualEnvironmentPython) ? virtualEnvironmentPython : (isWindows ? 'python' : 'python3'))
const npm = isWindows ? 'npm.cmd' : 'npm'

const sharedEnvironment = {
  ...process.env,
  FRAME2D_API_URL: `http://${host}:${apiPort}`,
}
const children = []
let isShuttingDown = false
const backendArguments = [
  '-m',
  'uvicorn',
  'frame2d.api:app',
  '--host',
  host,
  '--port',
  apiPort,
]

if (process.env.FRAME2D_API_RELOAD === '1') {
  backendArguments.push('--reload', '--reload-dir', join(rootDirectory, 'src'))
}

function startProcess(name, command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    env: sharedEnvironment,
    stdio: 'inherit',
  })
  children.push(child)

  child.on('error', (error) => {
    if (isShuttingDown) return
    console.error(`[frame2d] ${name} could not start: ${error.message}`)
    shutdown(1)
  })

  child.on('exit', (code, signal) => {
    if (isShuttingDown) return
    const reason = signal ? `signal ${signal}` : `code ${code ?? 1}`
    console.error(`[frame2d] ${name} stopped unexpectedly (${reason}).`)
    shutdown(code ?? 1)
  })

  return child
}

function stopProcess(child) {
  if (!child.pid || child.exitCode !== null) return
  if (isWindows) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    return
  }
  child.kill('SIGTERM')
}

function shutdown(exitCode = 0) {
  if (isShuttingDown) return
  isShuttingDown = true
  for (const child of children) stopProcess(child)
  setTimeout(() => process.exit(exitCode), 50)
}

process.once('SIGINT', () => shutdown(0))
process.once('SIGTERM', () => shutdown(0))
process.once('exit', () => {
  for (const child of children) stopProcess(child)
})

console.log('[frame2d] Starting frontend and backend...')
console.log(`[frame2d] App:     http://${host}:${frontendPort}`)
console.log(`[frame2d] API:     http://${host}:${apiPort}`)
console.log(`[frame2d] API docs: http://${host}:${apiPort}/docs`)
console.log('[frame2d] Press Ctrl+C to stop both services.\n')

startProcess(
  'backend',
  python,
  backendArguments,
  rootDirectory,
)

startProcess(
  'frontend',
  npm,
  ['--prefix', frontendDirectory, 'run', 'dev', '--', '--host', host, '--port', frontendPort, '--strictPort'],
  rootDirectory,
)
