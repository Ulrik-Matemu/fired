import { ipcMain } from 'electron';
import crypto from 'crypto';
import {
  IPC_CHANNELS,
  AddConnectionRequest,
  ConnectionInfo,
  TestConnectionResult,
} from '@shared/ipc-types';
import { credentialStore } from '../storage/credentialStore';
import { connectionManager } from '../firebase/connectionManager';

export function registerConnectionIpc(): void {
  // Add a new connection
  ipcMain.handle(
    IPC_CHANNELS.CONNECTION_ADD,
    async (_event, req: AddConnectionRequest): Promise<ConnectionInfo> => {
      if (!req || typeof req !== 'object') {
        throw new Error('Invalid request payload');
      }
      if (!req.name || typeof req.name !== 'string' || !req.name.trim()) {
        throw new Error('Project display name is required');
      }
      if (!req.serviceAccountJson || typeof req.serviceAccountJson !== 'string') {
        throw new Error('Service account JSON is required');
      }

      // Test credentials before saving
      const testResult = await connectionManager.testCredentials(req.serviceAccountJson);
      if (!testResult.success) {
        throw new Error(testResult.error?.message || 'Invalid Firebase service account credentials');
      }

      const connectionId = crypto.randomUUID();
      const metadata = {
        name: req.name.trim(),
        projectId: testResult.projectId || 'unknown',
        clientEmail: testResult.clientEmail || 'unknown',
      };

      const savedInfo = await credentialStore.saveCredential(
        connectionId,
        metadata,
        req.serviceAccountJson
      );

      // Connect and warm up cache
      await connectionManager.connect(connectionId);

      return savedInfo;
    }
  );

  // Remove connection
  ipcMain.handle(
    IPC_CHANNELS.CONNECTION_REMOVE,
    async (_event, id: string): Promise<boolean> => {
      if (!id || typeof id !== 'string') {
        throw new Error('Connection ID is required');
      }
      await connectionManager.disconnect(id);
      return credentialStore.deleteCredential(id);
    }
  );

  // List all connections (metadata only, no decrypted secrets)
  ipcMain.handle(
    IPC_CHANNELS.CONNECTION_LIST,
    async (): Promise<ConnectionInfo[]> => {
      return credentialStore.listConnectionMetadata();
    }
  );

  // Test an existing saved connection
  ipcMain.handle(
    IPC_CHANNELS.CONNECTION_TEST,
    async (_event, id: string): Promise<TestConnectionResult> => {
      if (!id || typeof id !== 'string') {
        return {
          success: false,
          error: { type: 'unknown', message: 'Connection ID is required' },
        };
      }
      try {
        const json = await credentialStore.getCredential(id);
        return connectionManager.testCredentials(json);
      } catch (err: unknown) {
        return {
          success: false,
          error: { type: 'auth', message: (err as Error).message },
        };
      }
    }
  );

  // Test raw unsaved JSON string
  ipcMain.handle(
    IPC_CHANNELS.CONNECTION_TEST_RAW,
    async (_event, jsonString: string): Promise<TestConnectionResult> => {
      if (!jsonString || typeof jsonString !== 'string') {
        return {
          success: false,
          error: { type: 'auth', message: 'Service account JSON string is required' },
        };
      }
      return connectionManager.testCredentials(jsonString);
    }
  );

  // Explicit disconnect
  ipcMain.handle(
    IPC_CHANNELS.CONNECTION_DISCONNECT,
    async (_event, id: string): Promise<void> => {
      if (!id || typeof id !== 'string') {
        throw new Error('Connection ID is required');
      }
      await connectionManager.disconnect(id);
    }
  );

  // Update read-only setting
  ipcMain.handle(
    IPC_CHANNELS.CONNECTION_UPDATE_READONLY,
    async (_event, req: { connectionId: string; readOnly: boolean }): Promise<boolean> => {
      if (!req || !req.connectionId) {
        throw new Error('connectionId is required');
      }
      return credentialStore.updateReadOnly(req.connectionId, req.readOnly);
    }
  );
}
