import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import { execSync } from 'node:child_process'

function stopElectronDevApp() {
  const child = process.electronApp
  if (!child) return

  const pid = Number(child.pid)
  child.removeAllListeners()

  if (!Number.isInteger(pid) || pid <= 0) {
    process.electronApp = undefined
    return
  }

  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' })
    } else {
      child.kill('SIGTERM')
    }
  } catch {
    try {
      child.kill()
    } catch {
      // Ignore cleanup failures; Vite should keep serving and restart Electron.
    }
    console.warn(`[vite] Electron cleanup failed for PID ${pid}; continuing restart.`)
  } finally {
    process.electronApp = undefined
  }
}

function electronBuildOptions(output) {
  return {
    rolldownOptions: {
      external: ['sqlite3'],
      ...(output ? { output } : {})
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.js',
        async onstart({ startup }) {
          stopElectronDevApp()
          await startup()
        },
        vite: {
          build: electronBuildOptions()
        }
      },
      {
        entry: 'electron/preload.js',
        onstart({ reload }) {
          reload()
        },
        vite: {
          build: electronBuildOptions({
            codeSplitting: false,
            entryFileNames: '[name].js',
            chunkFileNames: '[name].js',
            assetFileNames: '[name].[ext]'
          })
        }
      },
    ]),
  ],
  base: './', // Important for local file resolution in Electron production build
})
