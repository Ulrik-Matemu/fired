import { ipcMain } from 'electron';
import vm from 'vm';
import { IPC_CHANNELS, ScriptExecuteRequest, ScriptExecuteResponse } from '@shared/ipc-types';
import { connectionManager } from '../firebase/connectionManager';
import { credentialStore } from '../storage/credentialStore';

function formatLogArg(arg: unknown): string {
  if (arg === null) return 'null';
  if (arg === undefined) return 'undefined';
  if (typeof arg === 'string') return arg;
  if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg);
  try {
    return JSON.stringify(arg, null, 2);
  } catch {
    return String(arg);
  }
}

export function registerScriptIpc(): void {
  ipcMain.handle(
    IPC_CHANNELS.SCRIPT_EXECUTE,
    async (_event, req: ScriptExecuteRequest): Promise<ScriptExecuteResponse> => {
      const startTime = Date.now();
      const logs: string[] = [];

      if (!req.connectionId || !req.script) {
        return {
          success: false,
          logs,
          error: 'connectionId and script code are required',
          durationMs: 0,
        };
      }

      // Security check: strictly block scripts if connection is read-only
      if (credentialStore.isReadOnly(req.connectionId)) {
        return {
          success: false,
          logs: ['[Security] Script execution blocked: Connection is in READ-ONLY mode.'],
          error: 'Permission denied: Connection is in read-only mode.',
          durationMs: 0,
        };
      }

      try {
        const db = await connectionManager.getFirestore(req.connectionId);
        const activeColRef = req.collectionPath ? db.collection(req.collectionPath) : null;

        // Sandboxed logger
        const sandboxedConsole = {
          log: (...args: unknown[]) => logs.push(args.map(formatLogArg).join(' ')),
          info: (...args: unknown[]) => logs.push('[INFO] ' + args.map(formatLogArg).join(' ')),
          warn: (...args: unknown[]) => logs.push('[WARN] ' + args.map(formatLogArg).join(' ')),
          error: (...args: unknown[]) => logs.push('[ERROR] ' + args.map(formatLogArg).join(' ')),
        };

        const sandbox = {
          db,
          collection: activeColRef,
          collectionPath: req.collectionPath,
          console: sandboxedConsole,
          Buffer,
          setTimeout,
          clearTimeout,
          Promise,
          JSON,
          Math,
          Date,
          Array,
          Object,
          Number,
          String,
          Boolean,
          RegExp,
          process: undefined,
          require: undefined,
          module: undefined,
          exports: undefined,
        };

        const context = vm.createContext(sandbox);

        // Wrap in async function to support top-level await seamlessly
        const wrappedScript = `(async () => {\n${req.script}\n})()`;

        const scriptObj = new vm.Script(wrappedScript, {
          filename: 'fired-script.js',
        });

        const executionPromise = scriptObj.runInContext(context, {
          timeout: 30000, // 30-second execution timeout protection
        });

        const result = await executionPromise;
        const durationMs = Date.now() - startTime;

        let formattedResult: unknown = result;
        if (result !== undefined) {
          try {
            // Test if result can be cloned over IPC
            formattedResult = JSON.parse(JSON.stringify(result));
          } catch {
            formattedResult = String(result);
          }
        }

        return {
          success: true,
          logs,
          result: formattedResult,
          durationMs,
        };
      } catch (err) {
        const durationMs = Date.now() - startTime;
        const errorMessage = (err as Error).message || String(err);
        logs.push(`[Runtime Error] ${errorMessage}`);

        return {
          success: false,
          logs,
          error: errorMessage,
          durationMs,
        };
      }
    }
  );
}
