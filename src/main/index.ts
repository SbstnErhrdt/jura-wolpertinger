import { existsSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  nativeImage,
  shell,
  type MessageBoxOptions,
  type OpenDialogOptions,
  type SaveDialogOptions
} from 'electron'
import electronUpdater from 'electron-updater'
import type {
  AddInlineCommentInput,
  CreateExamInput,
  GenerateAiCorrectionInput,
  SaveRevisionInput,
  SaveAiSettingsInput,
  TrashFolderInput,
  UpdateCorrectionInput,
  UpdateFolderInput,
  UpdateExamInput
} from '@shared/ipc'
import type { AttachmentRole, LearningTask } from '@shared/schemas'
import { AppServices } from './services/services'
import { seedDemoDataIfEnabled } from './services/demoData'
import { exportExamPdf } from './services/pdf'

let mainWindow: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null
let services: AppServices
let splashStartedAt = 0

const SPLASH_MINIMUM_MS = 700
const APP_NAME = 'Jura Wolpertinger'
const LEGACY_APP_NAME = 'Jura Klausuren Wolpertinger'
const UPDATE_CHECK_DELAY_MS = 3000
const { autoUpdater } = electronUpdater

function resolveAssetPath(...segments: string[]): string {
  const candidates = [
    join(process.cwd(), ...segments),
    join(__dirname, '..', '..', ...segments),
    join(process.resourcesPath, ...segments)
  ]
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]
}

function resolveAppIconPath(): string {
  const candidates =
    process.platform === 'darwin'
      ? [resolveAssetPath('build', 'icon.icns'), resolveAssetPath('build', 'icon.png'), resolveAssetPath('assets', 'icon.png')]
      : [resolveAssetPath('build', 'icon.png'), resolveAssetPath('assets', 'icon.png')]

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]
}

function resolveDisplayIconPath(): string {
  const candidates = [resolveAssetPath('build', 'icon.png'), resolveAssetPath('assets', 'icon.png')]
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]
}

function configureApplicationIdentity(): void {
  app.setName(APP_NAME)

  if (process.platform !== 'darwin') return

  const iconPath = resolveAppIconPath()
  const icon = nativeImage.createFromPath(iconPath)
  if (!icon.isEmpty()) {
    app.dock.setIcon(icon)
  }
}

function configureAutoUpdates(): void {
  if (!app.isPackaged || process.env.JURA_E2E === '1') return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.on('error', (error) => {
    console.warn('Update check failed:', error)
  })
  autoUpdater.on('update-downloaded', async () => {
    const window = mainWindow ?? BrowserWindow.getFocusedWindow()
    const options: MessageBoxOptions = {
      type: 'info',
      buttons: ['Jetzt neu starten', 'Später'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update bereit',
      message: 'Eine neue Version von Jura Wolpertinger wurde heruntergeladen.',
      detail: 'Starte die App neu, um das Update zu installieren.'
    }
    const result = window
      ? await dialog.showMessageBox(window, options)
      : await dialog.showMessageBox(options)

    if (result.response === 0) {
      autoUpdater.quitAndInstall(false, true)
    }
  })

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((error: unknown) => {
      console.warn('Update check failed:', error)
    })
  }, UPDATE_CHECK_DELAY_MS)
}

function createSplashWindow(): void {
  splashStartedAt = Date.now()
  const iconPath = resolveDisplayIconPath()
  const iconUrl = createSplashIconUrl(iconPath)

  splashWindow = new BrowserWindow({
    width: 420,
    height: 360,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    show: false,
    skipTaskbar: true,
    title: APP_NAME,
    backgroundColor: '#f5f7f8',
    icon: iconPath,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  splashWindow.once('ready-to-show', () => {
    splashWindow?.show()
  })
  splashWindow.on('closed', () => {
    splashWindow = null
  })
  splashWindow.loadURL(createSplashHtml(iconUrl))
}

function createWindow(): void {
  const iconPath = resolveDisplayIconPath()

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 1060,
    minHeight: 720,
    show: false,
    title: APP_NAME,
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.once('ready-to-show', revealMainWindow)
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle('users:current', () => services.getCurrentUser())
  ipcMain.handle('users:list', () => services.listUsers())
  ipcMain.handle('users:create', (_event, displayName: string) => services.createUser(displayName))
  ipcMain.handle('users:switch', (_event, userId: string) => services.switchUser(userId))
  ipcMain.handle('users:completeOnboarding', (_event, userId: string) =>
    services.completeOnboarding(userId)
  )
  ipcMain.handle('users:completeTour', (_event, userId: string) => services.completeTour(userId))
  ipcMain.handle('users:resetTour', (_event, userId: string) => services.resetTour(userId))

  ipcMain.handle('folders:list', () => services.listFolders())
  ipcMain.handle('folders:create', (_event, name: string, parentId?: string | null) =>
    services.createFolder(name, parentId ?? null)
  )
  ipcMain.handle('folders:update', (_event, input: UpdateFolderInput) => services.updateFolder(input))
  ipcMain.handle('folders:trash', (_event, input: TrashFolderInput) => services.trashFolder(input))
  ipcMain.handle('folders:restore', (_event, folderId: string) => services.restoreFolder(folderId))

  ipcMain.handle('exams:list', () => services.listExams())
  ipcMain.handle('exams:create', (_event, input: CreateExamInput) => services.createExam(input))
  ipcMain.handle('exams:get', (_event, id: string) => services.getExam(id))
  ipcMain.handle('exams:update', (_event, input: UpdateExamInput) => services.updateExam(input))
  ipcMain.handle('exams:trash', (_event, id: string) => services.trashExam(id))
  ipcMain.handle('exams:restore', (_event, id: string) => services.restoreExam(id))
  ipcMain.handle('exams:saveRevision', (_event, input: SaveRevisionInput) =>
    services.saveRevision(input.examId, input.content, input.kind ?? 'autosave')
  )
  ipcMain.handle('exams:submit', (_event, examId: string) => services.submitExam(examId))

  ipcMain.handle('submissions:get', (_event, submissionId: string) =>
    services.getSubmission(submissionId)
  )
  ipcMain.handle('analytics:list', () => services.listAnalyticsEntries())

  ipcMain.handle('ai:settingsStatus', () => services.getAiSettingsStatus())
  ipcMain.handle('ai:saveSettings', (_event, input: SaveAiSettingsInput) =>
    services.saveAiSettings(input)
  )
  ipcMain.handle('ai:generateCorrectionDraft', (_event, _input: GenerateAiCorrectionInput) => {
    throw new Error('KI-Korrektur ist noch nicht implementiert.')
  })
  ipcMain.handle('ai:listCorrectionDrafts', (_event, submissionId: string) =>
    services.listAiCorrectionDrafts(submissionId)
  )
  ipcMain.handle('ai:acceptCorrectionDraft', (_event, draftId: string) =>
    services.acceptAiCorrectionDraft(draftId)
  )
  ipcMain.handle('ai:rejectCorrectionDraft', (_event, draftId: string) =>
    services.rejectAiCorrectionDraft(draftId)
  )
  ipcMain.handle('learningTasks:list', () => services.listLearningTasks())
  ipcMain.handle(
    'learningTasks:updateStatus',
    (_event, taskId: string, status: LearningTask['status']) =>
      services.updateLearningTaskStatus(taskId, status)
  )

  ipcMain.handle('attachments:add', async (_event, examId: string, role: AttachmentRole = 'other') => {
    const window = BrowserWindow.getFocusedWindow() ?? mainWindow
    const options: OpenDialogOptions = {
      title: 'Prüfungsdatei importieren',
      properties: ['openFile']
    }
    const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options)
    if (result.canceled || !result.filePaths[0]) return null
    return services.addAttachmentFromPath(examId, result.filePaths[0], role)
  })

  ipcMain.handle('attachments:open', async (_event, attachmentId: string) => {
    const filePath = services.getAttachmentPath(attachmentId)
    const error = await shell.openPath(filePath)
    if (error) throw new Error(error)
  })

  ipcMain.handle('package:export', async (_event, examId: string) => {
    const exam = services.getExam(examId)
    const window = BrowserWindow.getFocusedWindow() ?? mainWindow
    const options: SaveDialogOptions = {
      title: '.jura exportieren',
      defaultPath: `${safeFileName(exam.title)}.jura`,
      filters: [{ name: 'Jura Paket', extensions: ['jura'] }]
    }
    const result = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return null
    return services.exportExamPackage(examId, result.filePath)
  })

  ipcMain.handle('package:import', async () => {
    const window = BrowserWindow.getFocusedWindow() ?? mainWindow
    const options: OpenDialogOptions = {
      title: '.jura importieren',
      properties: ['openFile'],
      filters: [{ name: 'Jura Paket', extensions: ['jura', 'zip'] }]
    }
    const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options)
    if (result.canceled || !result.filePaths[0]) return null
    return services.importExamPackage(result.filePaths[0])
  })

  ipcMain.handle('pdf:export', async (_event, examId: string) => {
    const outputPath = await exportExamPdf(services, examId)
    if (process.env.JURA_E2E !== '1') {
      await shell.showItemInFolder(outputPath)
    }
    return outputPath
  })

  ipcMain.handle('corrections:create', (_event, submissionId: string) =>
    services.createCorrection(submissionId)
  )
  ipcMain.handle('corrections:update', (_event, input: UpdateCorrectionInput) =>
    services.updateCorrection(input)
  )
  ipcMain.handle('comments:add', (_event, input: AddInlineCommentInput) =>
    services.addInlineComment(input)
  )
}

app.whenReady().then(() => {
  configureApplicationIdentity()
  createSplashWindow()
  services = new AppServices(resolveUserDataDir())
  if (!app.isPackaged && process.env.JURA_E2E !== '1') seedDemoDataIfEnabled(services)
  registerIpc()
  createWindow()
  configureAutoUpdates()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createSplashWindow()
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  services?.close()
})

function safeFileName(value: string): string {
  return (
    value
      .trim()
      .replace(/[/\\?%*:|"<>]/g, '-')
      .replace(/\s+/g, ' ')
      .slice(0, 80) || 'Jura'
  )
}

function resolveUserDataDir(): string {
  if (!app.isPackaged && process.env.JURA_E2E !== '1') {
    return join(process.cwd(), '.dev-data')
  }

  const currentDir = app.getPath('userData')
  const legacyDir = join(app.getPath('appData'), LEGACY_APP_NAME)

  if (legacyDir !== currentDir && existsSync(legacyDir) && !existsSync(currentDir)) {
    try {
      renameSync(legacyDir, currentDir)
    } catch {
      return currentDir
    }
  }

  return currentDir
}

function revealMainWindow(): void {
  const delay = Math.max(0, SPLASH_MINIMUM_MS - (Date.now() - splashStartedAt))
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
      if (!app.isPackaged && process.env.JURA_E2E !== '1') {
        mainWindow.webContents.openDevTools({ mode: 'detach' })
      }
    }
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close()
    }
  }, delay)
}

function createSplashIconUrl(iconPath: string): string {
  const icon = nativeImage.createFromPath(iconPath)
  if (icon.isEmpty()) return ''
  return icon.resize({ width: 264, height: 264, quality: 'best' }).toDataURL()
}

function createSplashHtml(iconUrl: string): string {
  return `data:text/html;charset=UTF-8,${encodeURIComponent(`
    <!doctype html>
    <html lang="de">
      <head>
        <meta charset="UTF-8" />
        <style>
          * {
            box-sizing: border-box;
          }
          html,
          body {
            height: 100%;
            margin: 0;
          }
          body {
            align-items: center;
            background: #f5f7f8;
            color: #263238;
            display: flex;
            font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            justify-content: center;
            overflow: hidden;
            user-select: none;
          }
          .splash {
            align-items: center;
            display: flex;
            flex-direction: column;
            gap: 18px;
            width: 100%;
          }
          .app-icon {
            height: 132px;
            object-fit: contain;
            width: 132px;
          }
          h1 {
            font-size: 21px;
            font-weight: 700;
            letter-spacing: 0;
            line-height: 1.2;
            margin: 0;
          }
          .loader {
            background: #dce8ed;
            border-radius: 999px;
            height: 4px;
            margin-top: 4px;
            overflow: hidden;
            width: 164px;
          }
          .loader::before {
            animation: load 1.1s ease-in-out infinite;
            background: #1f5f74;
            border-radius: inherit;
            content: "";
            display: block;
            height: 100%;
            width: 46%;
          }
          @keyframes load {
            0% {
              transform: translateX(-105%);
            }
            100% {
              transform: translateX(230%);
            }
          }
        </style>
      </head>
      <body>
        <main class="splash">
          ${iconUrl ? `<img class="app-icon" src="${iconUrl}" alt="" />` : '<div class="app-icon" aria-hidden="true"></div>'}
          <h1>Jura Wolpertinger</h1>
          <div class="loader" aria-hidden="true"></div>
        </main>
      </body>
    </html>
  `)}`
}
