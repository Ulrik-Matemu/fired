import React, { useState } from 'react';
import { X, Upload, CheckCircle2, AlertTriangle, Loader2, KeyRound, Sparkles, Globe, ExternalLink } from 'lucide-react';
import { TestConnectionResult } from '@shared/ipc-types';
import { useAppStore } from '../../store';

interface AddConnectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddConnectionDialog: React.FC<AddConnectionDialogProps> = ({ isOpen, onClose }) => {
  const { addConnection, setActiveConnectionId, setConnectionStatus, setConnectionExpanded } = useAppStore();

  const [authTab, setAuthTab] = useState<'serviceAccount' | 'oauth'>('serviceAccount');

  // Service Account tab state
  const [name, setName] = useState('');
  const [jsonContent, setJsonContent] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Google OAuth tab state
  const [oauthName, setOauthName] = useState('');
  const [oauthProjectId, setOauthProjectId] = useState('');
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleJsonChange = (val: string) => {
    setJsonContent(val);
    setTestResult(null);
    setSaveError(null);

    try {
      const parsed = JSON.parse(val);
      if (parsed.project_id && (!name || name === parsed.project_id)) {
        setName(parsed.project_id);
      }
    } catch {
      // ignore parse error while typing
    }
  };

  const handleSelectFile = async () => {
    try {
      const filePath = await window.api.openFileDialog({
        filters: [{ name: 'Firebase Service Account JSON', extensions: ['json'] }],
      });
      if (!filePath) return;

      const content = await window.api.readTextFile(filePath);
      const nameParts = filePath.split(/[/\\]/);
      setFileName(nameParts[nameParts.length - 1]);
      handleJsonChange(content);
    } catch (err) {
      setSaveError(`Failed to read file: ${(err as Error).message}`);
    }
  };

  const handleTest = async () => {
    if (!jsonContent.trim()) {
      setSaveError('Please select or paste a service account JSON first.');
      return;
    }
    setTesting(true);
    setTestResult(null);
    setSaveError(null);
    try {
      const res = await window.api.testRawConnection(jsonContent);
      setTestResult(res);
      if (res.success && res.projectId && !name) {
        setName(res.projectId);
      }
    } catch (err) {
      setTestResult({
        success: false,
        error: {
          type: 'unknown',
          message: (err as Error).message,
        },
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmitServiceAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !jsonContent.trim()) return;

    setSaving(true);
    setSaveError(null);
    try {
      const connInfo = await window.api.addConnection({
        name: name.trim(),
        serviceAccountJson: jsonContent.trim(),
      });

      addConnection(connInfo);
      setActiveConnectionId(connInfo.id);
      setConnectionStatus(connInfo.id, 'connected');
      setConnectionExpanded(connInfo.id, true);

      onClose();
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleStartGoogleOAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oauthProjectId.trim()) {
      setOauthError('Firebase Project ID is required.');
      return;
    }

    setOauthLoading(true);
    setOauthError(null);

    try {
      const connInfo = await window.api.startGoogleOAuth({
        name: oauthName.trim() || oauthProjectId.trim(),
        projectId: oauthProjectId.trim(),
      });

      addConnection(connInfo);
      setActiveConnectionId(connInfo.id);
      setConnectionStatus(connInfo.id, 'connected');
      setConnectionExpanded(connInfo.id, true);

      onClose();
    } catch (err) {
      setOauthError((err as Error).message);
    } finally {
      setOauthLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-xl border border-[#30363d] bg-[#161b22] text-[#c9d1d9] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#30363d] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Add Firebase Connection</h3>
              <p className="text-xs text-gray-400">Connect to a Firestore database project</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-[#21262d] hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-[#30363d] bg-[#0d1117] text-xs">
          <button
            type="button"
            onClick={() => setAuthTab('serviceAccount')}
            className={`flex-1 py-2.5 font-medium text-center border-b-2 transition-colors cursor-pointer ${
              authTab === 'serviceAccount'
                ? 'border-amber-500 text-white bg-[#161b22]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Service Account Key (JSON)
          </button>
          <button
            type="button"
            onClick={() => setAuthTab('oauth')}
            className={`flex-1 py-2.5 font-medium text-center border-b-2 transition-colors cursor-pointer ${
              authTab === 'oauth'
                ? 'border-amber-500 text-white bg-[#161b22]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Sign in with Google (OAuth)
          </button>
        </div>

        {/* Form Body */}
        {authTab === 'serviceAccount' ? (
          <form onSubmit={handleSubmitServiceAccount} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
            {/* Display Name */}
            <div className="space-y-1.5">
              <label className="block font-medium text-gray-200">
                Connection Display Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Production Firestore"
                className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none"
                required
              />
            </div>

            {/* Service Account File Picker */}
            <div className="space-y-1.5">
              <label className="block font-medium text-gray-200">
                Service Account Key File
              </label>
              <div
                onClick={handleSelectFile}
                className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#30363d] hover:border-amber-500/50 bg-[#0d1117] p-4 text-center cursor-pointer transition-colors"
              >
                <Upload className="h-6 w-6 text-gray-400 mb-1" />
                <span className="text-xs text-gray-300 font-medium">
                  {fileName ? fileName : 'Choose Service Account JSON File'}
                </span>
                <span className="text-[10px] text-gray-500 mt-0.5">
                  Click to browse from local computer
                </span>
              </div>
            </div>

            {/* Paste JSON */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block font-medium text-gray-200">
                  Or Paste Service Account JSON
                </label>
                {jsonContent && (
                  <button
                    type="button"
                    onClick={() => {
                      setJsonContent('');
                      setFileName(null);
                      setTestResult(null);
                    }}
                    className="text-[10px] text-gray-500 hover:text-gray-300"
                  >
                    Clear
                  </button>
                )}
              </div>
              <textarea
                rows={5}
                value={jsonContent}
                onChange={(e) => handleJsonChange(e.target.value)}
                placeholder='{"type": "service_account", "project_id": "...", ...}'
                className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] p-2.5 font-mono text-xs text-gray-300 placeholder-gray-600 focus:border-amber-500 focus:outline-none"
              />
            </div>

            {/* Test Result Banner */}
            {testResult && (
              <div
                className={`rounded-lg border p-3 text-xs ${
                  testResult.success
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-red-500/30 bg-red-500/10 text-red-300'
                }`}
              >
                {testResult.success ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    <span>
                      Connection verified! Connected to project <strong>{testResult.projectId}</strong>.
                    </span>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                    <div>
                      <div className="font-semibold">Connection test failed</div>
                      <div className="text-[11px] text-red-300/80 mt-0.5">
                        {testResult.error?.message}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {saveError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                <span>{saveError}</span>
              </div>
            )}

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-[#30363d]">
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || !jsonContent.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#30363d] bg-[#21262d] px-3.5 py-2 text-xs font-medium text-gray-300 hover:bg-[#30363d] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {testing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    <span>Test Connection</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg px-3.5 py-2 text-xs font-medium text-gray-400 hover:bg-[#21262d] hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !jsonContent.trim() || !name.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 px-4 py-2 text-xs font-semibold text-white shadow disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <span>Save & Connect</span>
                  )}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={handleStartGoogleOAuth} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
            <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3.5 space-y-2 text-indigo-200">
              <div className="flex items-center gap-2 font-semibold text-white">
                <Globe className="h-4 w-4 text-indigo-400" />
                <span>Google Account OAuth Flow</span>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Fired will open your default browser to authorize access to your Google Cloud & Firestore projects.
                Tokens are securely encrypted in your OS keychain.
              </p>
            </div>

            {/* Display Name */}
            <div className="space-y-1.5">
              <label className="block font-medium text-gray-200">
                Connection Display Name (Optional)
              </label>
              <input
                type="text"
                value={oauthName}
                onChange={(e) => setOauthName(e.target.value)}
                placeholder="e.g. My Personal Firebase Project"
                className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none"
              />
            </div>

            {/* Firebase Project ID */}
            <div className="space-y-1.5">
              <label className="block font-medium text-gray-200">
                Firebase Project ID
              </label>
              <input
                type="text"
                value={oauthProjectId}
                onChange={(e) => setOauthProjectId(e.target.value)}
                placeholder="e.g. my-firebase-app-123"
                className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-xs text-white placeholder-gray-500 font-mono focus:border-amber-500 focus:outline-none"
                required
              />
              <span className="text-[10px] text-gray-500 block">
                Found in Firebase Console Project Settings.
              </span>
            </div>

            {oauthError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                <span>{oauthError}</span>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#30363d]">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-3.5 py-2 text-xs font-medium text-gray-400 hover:bg-[#21262d] hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={oauthLoading || !oauthProjectId.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 px-4 py-2 text-xs font-semibold text-white shadow disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {oauthLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Waiting for browser sign-in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign in with Google</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
