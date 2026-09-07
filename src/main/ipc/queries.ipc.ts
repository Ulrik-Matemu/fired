import { ipcMain } from 'electron';
import { IPC_CHANNELS, SaveQueryRequest, SavedQuery } from '@shared/ipc-types';
import { savedQueryStore } from '../storage/savedQueryStore';

export function registerQueriesIpc(): void {
  ipcMain.handle(IPC_CHANNELS.QUERIES_LIST, async (_event, collectionPath?: string): Promise<SavedQuery[]> => {
    return savedQueryStore.listQueries(collectionPath);
  });

  ipcMain.handle(IPC_CHANNELS.QUERIES_SAVE, async (_event, req: SaveQueryRequest): Promise<SavedQuery> => {
    if (!req.name || !req.name.trim()) {
      throw new Error('Query name is required');
    }
    return savedQueryStore.saveQuery(req);
  });

  ipcMain.handle(IPC_CHANNELS.QUERIES_DELETE, async (_event, id: string): Promise<boolean> => {
    if (!id) {
      throw new Error('Query ID is required');
    }
    return savedQueryStore.deleteQuery(id);
  });
}
