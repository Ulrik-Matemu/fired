import { registerDialogIpc } from './dialog.ipc';
import { registerConnectionIpc } from './connection.ipc';
import { registerCollectionsIpc } from './collections.ipc';
import { registerDocumentsIpc } from './documents.ipc';
import { registerExportIpc } from './export.ipc';
import { registerImportIpc } from './import.ipc';
import { registerQueriesIpc } from './queries.ipc';
import { registerOAuthIpc } from './oauth.ipc';
import { registerScriptIpc } from './script.ipc';
import { registerLiveIpc } from './live.ipc';
import { registerBackupIpc } from './backup.ipc';

export function registerAllIpc(): void {
  registerDialogIpc();
  registerConnectionIpc();
  registerCollectionsIpc();
  registerDocumentsIpc();
  registerExportIpc();
  registerImportIpc();
  registerQueriesIpc();
  registerOAuthIpc();
  registerScriptIpc();
  registerLiveIpc();
  registerBackupIpc();
}
