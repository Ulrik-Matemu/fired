import React, { useState } from 'react';
import {
  Terminal,
  Play,
  X,
  Loader2,
  Clock,
  Copy,
  Check,
} from 'lucide-react';
import { ScriptExecuteResponse } from '@shared/ipc-types';

interface ScriptRunnerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  collectionPath?: string;
}

const TEMPLATES: { title: string; code: string }[] = [
  {
    title: 'Count Documents in Collection',
    code: `// Count documents in the active collection
const snapshot = await collection.get();
console.log('Total documents found:', snapshot.size);
return { count: snapshot.size };`,
  },
  {
    title: 'Batch Update Field',
    code: `// Batch update a field across all matching documents
const snapshot = await collection.limit(100).get();
const batch = db.batch();

let updatedCount = 0;
for (const doc of snapshot.docs) {
  batch.update(doc.ref, { updatedAt: new Date().toISOString() });
  updatedCount++;
}

await batch.commit();
console.log('Successfully updated docs:', updatedCount);
return { updatedCount };`,
  },
  {
    title: 'Custom Query & Inspect',
    code: `// Query specific documents and inspect fields
const snapshot = await collection.limit(10).get();
const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

console.log('Previewing documents:');
docs.forEach((d, i) => console.log(\`[\${i + 1}] ID: \${d.id}\`));

return docs;`,
  },
];

export const ScriptRunnerDialog: React.FC<ScriptRunnerDialogProps> = ({
  isOpen,
  onClose,
  connectionId,
  collectionPath,
}) => {
  const [script, setScript] = useState(TEMPLATES[0].code);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<ScriptExecuteResponse | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleRunScript = async () => {
    if (!script.trim() || running) return;
    setRunning(true);
    setOutput(null);

    try {
      const res = await window.api.executeScript({
        connectionId,
        collectionPath,
        script: script.trim(),
      });
      setOutput(res);
    } catch (err) {
      setOutput({
        success: false,
        logs: [`[Fatal Error] ${(err as Error).message}`],
        error: (err as Error).message,
        durationMs: 0,
      });
    } finally {
      setRunning(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRunScript();
    }
  };

  const handleCopyLogs = () => {
    if (!output) return;
    const text = output.logs.join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl rounded-xl border border-[#30363d] bg-[#161b22] text-[#c9d1d9] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#30363d] px-5 py-3.5 bg-[#161b22]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Terminal className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white">JavaScript / Node Script Shell</h3>
                {collectionPath && (
                  <span className="font-mono text-[11px] text-amber-300/80 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                    {collectionPath}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400">
                Execute scripts directly in the Firestore context with <code className="text-amber-300">db</code>, <code className="text-amber-300">collection</code>, and <code className="text-amber-300">await</code>.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-[#21262d] hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Template presets bar */}
        <div className="flex items-center gap-2 px-5 py-2 border-b border-[#21262d] bg-[#0d1117]/80 overflow-x-auto text-[11px]">
          <span className="text-gray-500 shrink-0 font-medium">Templates:</span>
          {TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.title}
              type="button"
              onClick={() => setScript(tmpl.code)}
              className="rounded border border-[#30363d] bg-[#161b22] px-2 py-0.5 text-gray-300 hover:text-white hover:border-amber-500/50 transition-colors cursor-pointer shrink-0"
            >
              {tmpl.title}
            </button>
          ))}
        </div>

        {/* Editor & Output Split Body */}
        <div className="flex-1 overflow-hidden flex flex-col p-4 gap-3">
          {/* Code Editor */}
          <div className="flex-1 flex flex-col min-h-[220px]">
            <div className="flex items-center justify-between pb-1.5 text-[11px] text-gray-400">
              <span className="font-semibold uppercase tracking-wider">Script Code (Async Context)</span>
              <span className="text-gray-500">Shortcut: Ctrl+Enter / Cmd+Enter to Run</span>
            </div>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write your Firestore script here..."
              className="flex-1 w-full rounded-lg border border-[#30363d] bg-[#0d1117] p-3 text-xs font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500 resize-none"
              spellCheck={false}
            />
          </div>

          {/* Output Console */}
          <div className="h-44 flex flex-col rounded-lg border border-[#30363d] bg-[#0d1117] overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#21262d] bg-[#161b22]/70 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-300 uppercase tracking-wider">Console Output</span>
                {output && (
                  <span className="flex items-center gap-1 text-[10px] text-gray-400 font-mono">
                    <Clock className="h-3 w-3 text-amber-400" />
                    <span>{output.durationMs}ms</span>
                  </span>
                )}
              </div>

              {output && output.logs.length > 0 && (
                <button
                  type="button"
                  onClick={handleCopyLogs}
                  className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-white cursor-pointer"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              )}
            </div>

            <div className="flex-1 p-2.5 overflow-y-auto font-mono text-xs space-y-1">
              {running ? (
                <div className="flex items-center gap-2 text-gray-500 py-4 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                  <span>Executing script in sandboxed Firestore context...</span>
                </div>
              ) : !output ? (
                <div className="text-gray-600 italic py-4 text-center">
                  Run a script above to see output logs and return values.
                </div>
              ) : (
                <>
                  {output.logs.map((log, idx) => (
                    <div
                      key={idx}
                      className={`whitespace-pre-wrap break-all ${
                        log.startsWith('[ERROR]') || log.startsWith('[Runtime Error]')
                          ? 'text-rose-400 font-semibold'
                          : log.startsWith('[WARN]')
                          ? 'text-amber-400'
                          : 'text-gray-300'
                      }`}
                    >
                      {log}
                    </div>
                  ))}

                  {output.result !== undefined && (
                    <div className="pt-2 border-t border-[#21262d] mt-2 text-emerald-300">
                      <span className="text-gray-500">[Returned Value]: </span>
                      {typeof output.result === 'object'
                        ? JSON.stringify(output.result, null, 2)
                        : String(output.result)}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#30363d] px-5 py-3 bg-[#161b22]">
          <span className="text-[11px] text-gray-500">
            Node.js sandbox timeout: 30s. Mutating operations respect Read-Only mode.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3.5 py-1.5 text-xs font-medium text-gray-400 hover:bg-[#21262d] hover:text-white transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              disabled={running || !script.trim()}
              onClick={handleRunScript}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-1.5 text-xs font-semibold text-white shadow transition-colors cursor-pointer"
            >
              {running ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Running...</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-white" />
                  <span>Run Script (Ctrl+Enter)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
