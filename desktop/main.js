/**
 * Vibeport Desktop — Electron main process
 *
 * Spawns the local node backend (node/src/index.js) via system Node.js,
 * waits for it to be ready, then opens a BrowserWindow at localhost:7331
 * which serves the built frontend.
 */

const { app, BrowserWindow, shell, Menu } = require('electron')
const { spawn }  = require('child_process')
const path       = require('path')
const http       = require('http')
const fs         = require('fs')

const PORT    = 7331
const isDev   = !app.isPackaged

// In packaged app, extraResources land in process.resourcesPath
const ROOT      = isDev ? path.join(__dirname, '..') : process.resourcesPath
const NODE_DIR  = path.join(ROOT, 'node')
const DIST_DIR  = isDev ? null : path.join(ROOT, 'frontend-dist')

let mainWindow = null
let backend    = null

// ── Find node binary ──────────────────────────────────────────────────────────
function findNode () {
  // Common install locations
  const candidates = [
    '/usr/local/bin/node',
    '/usr/bin/node',
    process.env.NODE_PATH,
    'node',   // hope it's on PATH
  ].filter(Boolean)

  for (const c of candidates) {
    try {
      require('child_process').execFileSync(c, ['--version'], { stdio: 'ignore' })
      return c
    } catch {}
  }
  return null
}

// ── Spawn backend ─────────────────────────────────────────────────────────────
function startBackend () {
  return new Promise((resolve, reject) => {
    const nodeBin = findNode()
    if (!nodeBin) {
      return reject(new Error('NODE_NOT_FOUND'))
    }

    const env = {
      ...process.env,
      NODE_ENV: 'production',
      // User data directory — persists across app updates
      DATA_DIR: path.join(app.getPath('userData'), 'data'),
    }

    backend = spawn(nodeBin, ['src/index.js'], {
      cwd:   NODE_DIR,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    backend.stdout.on('data', d => {
      const msg = d.toString()
      process.stdout.write('[node] ' + msg)
      if (msg.includes('Local API running')) resolve()
    })
    backend.stderr.on('data', d => process.stderr.write('[node] ' + d.toString()))
    backend.on('error', err => reject(err))
    backend.on('exit',  code => {
      if (code !== 0) reject(new Error(`Backend exited with code ${code}`))
    })

    // Fallback: poll health endpoint
    const poll = (retries = 30) => {
      http.get(`http://127.0.0.1:${PORT}/api/health`, res => {
        if (res.statusCode === 200) resolve()
        else retry()
      }).on('error', retry)
      function retry () {
        if (retries <= 0) return reject(new Error('Backend health check timed out'))
        setTimeout(() => poll(retries - 1), 1000)
      }
    }
    setTimeout(poll, 2000)
  })
}

// ── Loading splash ────────────────────────────────────────────────────────────
function createSplash () {
  const win = new BrowserWindow({
    width: 380, height: 260,
    backgroundColor: '#000000',
    frame: false,
    resizable: false,
    center: true,
    alwaysOnTop: true,
    webPreferences: { nodeIntegration: false },
  })
  win.loadURL(`data:text/html,<!DOCTYPE html>
<html><head><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#000;color:#00ff41;font-family:monospace;
       display:flex;flex-direction:column;align-items:center;
       justify-content:center;height:100vh;gap:1.2rem;user-select:none}
  h1{font-size:5rem;letter-spacing:.15em;line-height:1}
  p{color:#1a3a1a;font-size:.78rem;letter-spacing:.2em}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.25}}
  span{animation:pulse 1.4s ease infinite}
</style></head><body>
  <h1>V</h1>
  <p>VIBEPORT</p>
  <p style="color:#333;font-size:.65rem">initializing node<span>...</span></p>
</body></html>`)
  return win
}

// ── Error screen ──────────────────────────────────────────────────────────────
function createErrorWindow (message) {
  const win = new BrowserWindow({
    width: 520, height: 320,
    backgroundColor: '#000000',
    webPreferences: { nodeIntegration: false },
    title: 'Vibeport — Startup Error',
  })
  const nodeUrl = 'https://nodejs.org/en/download'
  win.loadURL(`data:text/html,<!DOCTYPE html>
<html><head><style>
  body{background:#000;color:#fff;font-family:monospace;padding:2.5rem;line-height:1.6}
  h2{color:#ff4040;margin-bottom:1rem}
  p{color:#666;margin-bottom:.75rem}
  a{color:#00ff41;text-decoration:none}
  code{background:#111;padding:.15rem .4rem;font-size:.85rem}
</style></head><body>
  <h2>Failed to start Vibeport</h2>
  <p>${message === 'NODE_NOT_FOUND'
    ? 'Node.js was not found on your system. Please install it to run Vibeport.'
    : 'The Vibeport backend failed to start: ' + message}
  </p>
  ${message === 'NODE_NOT_FOUND'
    ? `<p>Download Node.js (v20 or higher): <a href="${nodeUrl}">${nodeUrl}</a></p>`
    : '<p>Check the console for details. You can also run <code>npm run dev</code> in the vibeport directory.</p>'
  }
</body></html>`)
  return win
}

// ── Main window ───────────────────────────────────────────────────────────────
async function createMainWindow () {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#000000',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'Vibeport',
  })

  // Remove default menu bar (keep devtools via Ctrl+Shift+I)
  if (!isDev) Menu.setApplicationMenu(null)

  mainWindow.loadURL(`http://127.0.0.1:${PORT}`)

  // Open external links in browser, not in electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  const splash = createSplash()

  try {
    await startBackend()
    splash.close()
    await createMainWindow()
  } catch (err) {
    splash.close()
    createErrorWindow(err.message)
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (mainWindow === null && app.isReady()) createMainWindow()
})

app.on('before-quit', () => {
  if (backend) { backend.kill('SIGTERM'); backend = null }
})
