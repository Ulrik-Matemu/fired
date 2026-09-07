import { ipcMain, dialog, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc-types'

export function registerDialogIpc(): void {
  ipcMain.handle(IPC_CHANNELS.DIALOG_OPEN_FILE, async (_event, options?: { filters?: { name: string; extensions: string[] }[] }) => {
    const window = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(window || undefined!, {
      properties: ['openFile'],
      filters: options?.filters
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })

  ipcMain.handle(IPC_CHANNELS.DIALOG_SAVE_FILE, async (_event, options?: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => {
    const window = BrowserWindow.getFocusedWindow()
    const result = await dialog.showSaveDialog(window || undefined!, {
      defaultPath: options?.defaultPath,
      filters: options?.filters
    })
    if (result.canceled || !result.filePath) {
      return null
    }
    return result.filePath
  })

  ipcMain.handle(IPC_CHANNELS.DIALOG_READ_FILE, async (_event, filePath: string) => {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('File path is required')
    }
    const fs = await import('fs/promises')
    return fs.readFile(filePath, 'utf-8')
  })

  ipcMain.handle(IPC_CHANNELS.SYSTEM_OPEN_EXTERNAL, async (_event, url: string) => {
    if (!url || typeof url !== 'string') {
      throw new Error('URL is required')
    }
    const { shell } = await import('electron')
    await shell.openExternal(url)
  })
}
