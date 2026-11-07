import React, { useState } from 'react';
import { X, Network, Copy, Check, Terminal, ExternalLink, Cpu, Sparkles } from 'lucide-react';
import { RunStats } from '../game/types';
import { generateAstrocadeManifest } from '../game/rules';

interface AstrocadeBridgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: RunStats;
}

export const AstrocadeBridgeModal: React.FC<AstrocadeBridgeModalProps> = ({
  isOpen,
  onClose,
  stats,
}) => {
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  if (!isOpen) return null;

  const mcpCommand = 'gemini mcp add --scope user --transport http astrocade https://mcp.astrocade.com/mcp';
  const manifest = generateAstrocadeManifest(stats);
  const manifestString = JSON.stringify(manifest, null, 2);

  const handleCopyCmd = () => {
    navigator.clipboard.writeText(mcpCommand);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(manifestString);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/85 pointer-events-auto select-none">
      <div className="w-full max-w-2xl bg-slate-900 border border-sky-500/30 rounded-2xl p-6 md:p-8 shadow-2xl flex flex-col gap-5 text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-950/80 border border-sky-500/40 text-sky-400">
              <Network className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold font-mono tracking-wide text-white">
                Astrocade MCP Bridge
              </h3>
              <p className="text-xs font-mono text-sky-400">
                Model Context Protocol Integration · https://mcp.astrocade.com/mcp
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Astrocade Bridge"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Overview Box */}
        <div className="bg-sky-950/30 border border-sky-500/20 rounded-xl p-4 text-xs font-mono text-sky-200/90 leading-relaxed flex flex-col gap-2">
          <div className="flex items-center gap-2 font-bold text-sky-300">
            <Sparkles className="w-4 h-4 text-sky-400" />
            <span>Connected AI Game Creation Pipeline</span>
          </div>
          <p>
            Astrocade operates a hosted Model Context Protocol (MCP) server connecting external AI coding assistants directly to the Astrocade ecosystem. Games built in this workspace can be packaged and published to millions of players through the Astrocade MCP pipeline.
          </p>
        </div>

        {/* MCP Setup CLI Command */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-sky-400" />
              <span>MCP Client Setup Command</span>
            </span>
            <button
              type="button"
              onClick={handleCopyCmd}
              aria-label="Copy MCP Command"
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono text-sky-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors cursor-pointer"
            >
              {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCmd ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl font-mono text-xs text-sky-300 overflow-x-auto select-all">
            {mcpCommand}
          </div>
        </div>

        {/* Live Game Manifest */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-amber-400" />
              <span>Live Astrocade Manifest Payload (v1)</span>
            </span>
            <button
              type="button"
              onClick={handleCopyJson}
              aria-label="Copy Manifest JSON"
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono text-sky-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors cursor-pointer"
            >
              {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedJson ? 'Copied JSON' : 'Copy JSON'}</span>
            </button>
          </div>
          <pre className="bg-slate-950 border border-slate-800 p-3 rounded-xl font-mono text-[11px] text-slate-300 overflow-x-auto max-h-56 leading-relaxed">
            {manifestString}
          </pre>
        </div>

        {/* External Link & Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <a
            href="https://astrocade.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-mono text-sky-400 hover:text-sky-300 transition-colors"
          >
            <span>Learn more at astrocade.com</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="px-5 py-2 text-xs font-bold uppercase tracking-wider font-mono rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
