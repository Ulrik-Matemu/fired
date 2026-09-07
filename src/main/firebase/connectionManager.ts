import { getApps, initializeApp, deleteApp, App, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { OAuth2Client } from 'google-auth-library';
import { credentialStore } from '../storage/credentialStore';
import { CollectionInfo, ConnectionError, TestConnectionResult } from '@shared/ipc-types';

export interface LiveConnection {
  app?: App;
  firestore: Firestore;
  status: 'connected' | 'error' | 'disconnected';
  lastError?: ConnectionError;
}

function parseServiceAccount(jsonString: string): { serviceAccount: ServiceAccount; projectId: string; clientEmail: string } {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error('Service account key is not valid JSON.');
  }

  const projectId = (parsed.project_id || parsed.projectId) as string;
  const clientEmail = (parsed.client_email || parsed.clientEmail) as string;
  const privateKey = (parsed.private_key || parsed.privateKey) as string;

  if (!projectId) {
    throw new Error('Service account JSON is missing "project_id".');
  }
  if (!clientEmail) {
    throw new Error('Service account JSON is missing "client_email".');
  }
  if (!privateKey) {
    throw new Error('Service account JSON is missing "private_key".');
  }

  return {
    serviceAccount: parsed as unknown as ServiceAccount,
    projectId,
    clientEmail,
  };
}

function classifyError(err: unknown): ConnectionError {
  const error = err as { code?: string | number; message?: string; details?: string };
  const message = error.message || error.details || String(err);
  const code = String(error.code || '').toLowerCase();
  const lowerMsg = message.toLowerCase();

  // Auth / Permission errors
  if (
    code.includes('auth') ||
    code.includes('permission-denied') ||
    code.includes('unauthenticated') ||
    code === '16' || // gRPC UNAUTHENTICATED
    code === '7' || // gRPC PERMISSION_DENIED
    lowerMsg.includes('invalid_grant') ||
    lowerMsg.includes('private key') ||
    lowerMsg.includes('permission denied') ||
    lowerMsg.includes('unauthorized') ||
    lowerMsg.includes('credential') ||
    lowerMsg.includes('jwt')
  ) {
    return {
      type: 'auth',
      message: `Authentication failed: ${message}`,
    };
  }

  // Network / Offline errors
  if (
    code.includes('unavailable') ||
    code.includes('deadline-exceeded') ||
    code === '14' || // gRPC UNAVAILABLE
    code === '4' || // gRPC DEADLINE_EXCEEDED
    lowerMsg.includes('econnrefused') ||
    lowerMsg.includes('etimedout') ||
    lowerMsg.includes('network') ||
    lowerMsg.includes('enotfound')
  ) {
    return {
      type: 'network',
      message: `Network error: Unable to reach Firestore servers (${message})`,
    };
  }

  // Unknown / generic errors
  return {
    type: 'unknown',
    message,
  };
}

class ConnectionManager {
  private activeConnections: Map<string, LiveConnection> = new Map();

  /**
   * Test a service account JSON string without persisting it.
   */
  async testCredentials(jsonString: string): Promise<TestConnectionResult> {
    const tempId = `test-${Date.now()}`;
    let testApp: App | null = null;

    try {
      const { serviceAccount, projectId, clientEmail } = parseServiceAccount(jsonString);

      testApp = initializeApp(
        {
          credential: cert(serviceAccount),
          projectId,
        },
        tempId
      );

      const db = getFirestore(testApp);
      db.settings({ ignoreUndefinedProperties: true });

      // Run a lightweight test query
      await db.listCollections();

      return {
        success: true,
        projectId,
        clientEmail,
      };
    } catch (err) {
      return {
        success: false,
        error: classifyError(err),
      };
    } finally {
      if (testApp) {
        try {
          await deleteApp(testApp);
        } catch {
          // ignore cleanup error on test app
        }
      }
    }
  }

  /**
   * Connect to a saved connection ID and cache the live Firestore instance.
   * Supports both serviceAccount JSON and OAuth tokens.
   */
  async connect(connectionId: string): Promise<{ success: boolean; error?: ConnectionError }> {
    // 1. Return cached live connection if already connected
    const existing = this.activeConnections.get(connectionId);
    if (existing && existing.status === 'connected') {
      return { success: true };
    }

    try {
      // 2. Load and decrypt credential
      const json = await credentialStore.getCredential(connectionId);
      const meta = await credentialStore.getConnectionMetadata(connectionId);
      const parsedCred = JSON.parse(json);

      let firestore: Firestore;
      let app: App | undefined;

      if (parsedCred.type === 'oauth' && parsedCred.tokens) {
        // OAuth connection
        const oauth2Client = new OAuth2Client({
          clientId: parsedCred.clientId,
          clientSecret: parsedCred.clientSecret,
        });
        oauth2Client.setCredentials(parsedCred.tokens);

        firestore = new Firestore({
          projectId: meta?.projectId || parsedCred.projectId,
          authClient: oauth2Client as any,
        });
        firestore.settings({ ignoreUndefinedProperties: true });

        // Verify connectivity
        await firestore.listCollections();
      } else {
        // Service account connection
        const { serviceAccount, projectId } = parseServiceAccount(json);

        app = getApps().find((a) => a.name === connectionId);
        if (!app) {
          app = initializeApp(
            {
              credential: cert(serviceAccount),
              projectId,
            },
            connectionId
          );
        }

        firestore = getFirestore(app);
        firestore.settings({ ignoreUndefinedProperties: true });

        // Verify connectivity
        await firestore.listCollections();
      }

      const liveConnection: LiveConnection = {
        app,
        firestore,
        status: 'connected',
      };
      this.activeConnections.set(connectionId, liveConnection);

      return { success: true };
    } catch (err) {
      const classified = classifyError(err);
      this.activeConnections.set(connectionId, {
        app: this.activeConnections.get(connectionId)?.app,
        firestore: this.activeConnections.get(connectionId)?.firestore as Firestore,
        status: 'error',
        lastError: classified,
      });
      return {
        success: false,
        error: classified,
      };
    }
  }

  /**
   * Disconnect an active connection and free gRPC resources.
   */
  async disconnect(connectionId: string): Promise<void> {
    const conn = this.activeConnections.get(connectionId);
    if (conn && conn.app) {
      try {
        await deleteApp(conn.app);
      } catch (err) {
        console.warn(`[ConnectionManager] Error deleting app ${connectionId}:`, err);
      }
    }
    this.activeConnections.delete(connectionId);
  }

  /**
   * List top-level collections or subcollections under a document path.
   */
  async listCollections(connectionId: string, parentPath?: string): Promise<CollectionInfo[]> {
    let conn = this.activeConnections.get(connectionId);
    if (!conn || conn.status !== 'connected') {
      const connectResult = await this.connect(connectionId);
      if (!connectResult.success) {
        throw new Error(connectResult.error?.message || 'Failed to connect to Firebase project');
      }
      conn = this.activeConnections.get(connectionId)!;
    }

    const db = conn.firestore;

    if (!parentPath) {
      // Root collections
      const collections = await db.listCollections();
      return collections.map((col) => ({
        id: col.id,
        path: col.path,
      }));
    } else {
      // Subcollections under document path
      const docRef = db.doc(parentPath);
      const subcollections = await docRef.listCollections();
      return subcollections.map((col) => ({
        id: col.id,
        path: col.path,
      }));
    }
  }

  /**
   * Get the current status of a connection.
   */
  getConnectionStatus(connectionId: string): 'connected' | 'disconnected' | 'error' {
    const conn = this.activeConnections.get(connectionId);
    return conn ? conn.status : 'disconnected';
  }

  /**
   * Get Firestore instance for a connection, auto-connecting if needed.
   */
  async getFirestore(connectionId: string): Promise<Firestore> {
    let conn = this.activeConnections.get(connectionId);
    if (!conn || conn.status !== 'connected') {
      const connectResult = await this.connect(connectionId);
      if (!connectResult.success) {
        throw new Error(connectResult.error?.message || `Failed to connect to Firebase project ${connectionId}`);
      }
      conn = this.activeConnections.get(connectionId)!;
    }
    return conn.firestore;
  }

  /**
   * Clean up all active apps (called on app quit).
   */
  async cleanupAll(): Promise<void> {
    const deletePromises: Promise<void>[] = [];
    for (const [id, conn] of this.activeConnections.entries()) {
      if (conn.app) {
        deletePromises.push(
          deleteApp(conn.app).catch((err) => {
            console.warn(`[ConnectionManager] Cleanup error for ${id}:`, err);
          })
        );
      }
    }
    this.activeConnections.clear();
    await Promise.all(deletePromises);
  }
}

export const connectionManager = new ConnectionManager();
