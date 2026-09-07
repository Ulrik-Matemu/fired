# Deployment & Packaging Guide for Fired

This guide explains how to package native desktop installers for **Fired** and how to deploy the interactive browser demo to **Vercel** or **Netlify**.

---

## 1. Desktop Packaging (`electron-builder`)

Fired uses `electron-builder` to package standalone native binaries with bundled Chromium and Node runtimes.

### Packaging Commands
- **Current OS (Linux / deb & AppImage)**:
  ```bash
  pnpm run dist:linux
  ```
- **macOS (.dmg & .zip)**:
  ```bash
  pnpm run dist:mac
  ```
- **Windows (.exe NSIS installer)**:
  ```bash
  pnpm run dist:win
  ```
- **Generic / All Targets**:
  ```bash
  pnpm run dist
  ```

### Build Artifacts
All packaged binaries and installers are output to the `./release/` directory:
- Linux: `release/Fired-1.0.0.AppImage` and `release/fired_1.0.0_amd64.deb`
- macOS: `release/Fired-1.0.0.dmg` and `release/Fired-1.0.0-mac.zip`
- Windows: `release/Fired Setup 1.0.0.exe`

> **Note on Code Signing**: Local builds are configured with `--publish=never` and unsigned profiles. Once you acquire an Apple Developer Certificate or Windows Authenticode token, uncomment the entitlements in `electron-builder.yml`.

---

## 2. Interactive Web Demo Deployment

Fired includes an air-gapped, in-memory browser demo mode (`src/renderer/src/demo/mockApi.ts`) that runs anywhere without requiring backend servers, GCP credentials, or Firebase setup.

### Local Testing
To test the web demo locally before deploying:
```bash
# 1. Build static SPA bundle
pnpm run build:web

# 2. Preview locally at http://localhost:4173
pnpm run preview:web
```

### Deploying to Vercel (Recommended)
`vercel.json` is already configured in the repository root:
1. Push your repository to GitHub.
2. In Vercel, click **"Add New Project"** and import this repository.
3. Vercel automatically detects the configuration from `vercel.json`:
   - **Framework Preset**: `Vite`
   - **Build Command**: `pnpm run build:web`
   - **Output Directory**: `dist-web`
4. Click **Deploy**. Your interactive demo is live!

### Deploying to Netlify
`netlify.toml` is also pre-configured:
1. In Netlify, click **"Import from Git"**.
2. Select your repository.
3. Netlify automatically reads `netlify.toml`:
   - **Build Command**: `pnpm run build:web`
   - **Publish directory**: `dist-web`
4. Click **Deploy Site**.
