import { ipcMain, shell } from 'electron';
import http from 'http';
import { AddressInfo } from 'net';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { IPC_CHANNELS, StartGoogleOAuthRequest, ConnectionInfo } from '@shared/ipc-types';
import { credentialStore } from '../storage/credentialStore';
import { connectionManager } from '../firebase/connectionManager';

// Default OAuth credentials for desktop applications if user does not provide custom Client ID
// (standard Google OAuth 2.0 desktop client ID)
const DEFAULT_CLIENT_ID = '942487441865-g400j19n7nss24f1q33q4k1b1c34a2e7.apps.googleusercontent.com';

export function registerOAuthIpc(): void {
  ipcMain.handle(
    IPC_CHANNELS.AUTH_GOOGLE_START,
    async (_event, req: StartGoogleOAuthRequest): Promise<ConnectionInfo> => {
      if (!req.projectId || !req.projectId.trim()) {
        throw new Error('Firebase Project ID is required for Google sign-in');
      }

      const clientId = req.clientId?.trim() || DEFAULT_CLIENT_ID;
      const clientSecret = req.clientSecret?.trim() || undefined;

      return new Promise<ConnectionInfo>((resolve, reject) => {
        const server = http.createServer();

        server.listen(0, '127.0.0.1', async () => {
          try {
            const port = (server.address() as AddressInfo).port;
            const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;
            const stateToken = crypto.randomBytes(16).toString('hex');

            const oauth2Client = new OAuth2Client({
              clientId,
              clientSecret,
              redirectUri,
            });

            const authUrl = oauth2Client.generateAuthUrl({
              access_type: 'offline',
              prompt: 'consent',
              state: stateToken,
              scope: [
                'https://www.googleapis.com/auth/cloud-platform',
                'https://www.googleapis.com/auth/datastore',
                'https://www.googleapis.com/auth/userinfo.email',
              ],
            });

            server.on('request', async (httpReq, httpRes) => {
              try {
                const reqUrl = new URL(httpReq.url || '', `http://127.0.0.1:${port}`);
                if (reqUrl.pathname !== '/oauth2callback') {
                  httpRes.writeHead(404);
                  httpRes.end();
                  return;
                }

                const code = reqUrl.searchParams.get('code');
                const state = reqUrl.searchParams.get('state');
                const errParam = reqUrl.searchParams.get('error');

                if (state !== stateToken) {
                  httpRes.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
                  httpRes.end('<h2>Authentication Failed: CSRF state token mismatch</h2>');
                  server.close();
                  reject(new Error('Authentication failed: Invalid state parameter.'));
                  return;
                }

                if (errParam || !code) {
                  httpRes.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
                  httpRes.end(`
                    <html>
                      <body style="font-family: system-ui, sans-serif; background: #0d1117; color: #f85149; padding: 40px; text-align: center;">
                        <h2>Authentication Failed</h2>
                        <p>${errParam || 'Authorization code was not provided.'}</p>
                      </body>
                    </html>
                  `);
                  server.close();
                  reject(new Error(errParam || 'Authorization denied'));
                  return;
                }

                // Exchange code for tokens
                const { tokens } = await oauth2Client.getToken(code);
                oauth2Client.setCredentials(tokens);

                let userEmail = 'google-user';
                try {
                  const tokenInfo = await oauth2Client.getTokenInfo(tokens.access_token!);
                  if (tokenInfo.email) userEmail = tokenInfo.email;
                } catch {
                  // Ignore token info failure
                }

                httpRes.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                httpRes.end(`
                  <html>
                    <body style="font-family: system-ui, sans-serif; background: #0d1117; color: #e6edf3; padding: 40px; text-align: center;">
                      <h2 style="color: #3fb950;">✓ Authentication Successful!</h2>
                      <p>Connected as <strong>${userEmail}</strong>.</p>
                      <p style="color: #8b949e; font-size: 13px;">You can now close this browser tab and return to <strong>Fired</strong>.</p>
                    </body>
                  </html>
                `);

                server.close();

                // Store encrypted OAuth payload
                const connectionId = crypto.randomUUID();
                const credentialPayload = JSON.stringify({
                  type: 'oauth',
                  clientId,
                  clientSecret,
                  tokens,
                });

                const metadata = {
                  name: req.name?.trim() || req.projectId.trim(),
                  projectId: req.projectId.trim(),
                  clientEmail: userEmail,
                  authType: 'oauth' as const,
                };

                const savedInfo = await credentialStore.saveCredential(
                  connectionId,
                  metadata,
                  credentialPayload
                );

                // Initialize connection
                await connectionManager.connect(connectionId);
                resolve(savedInfo);
              } catch (e) {
                server.close();
                reject(e);
              }
            });

            // Open user's default browser
            await shell.openExternal(authUrl);
          } catch (e) {
            server.close();
            reject(e);
          }
        });

        // 3-minute timeout
        server.setTimeout(180000, () => {
          server.close();
          reject(new Error('Google sign-in timed out. Please try again.'));
        });
      });
    }
  );
}
