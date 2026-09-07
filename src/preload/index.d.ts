import { ElectronAPI } from '@electron-toolkit/preload'
import { AppApi } from '@shared/ipc-types'

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppApi
  }
}
