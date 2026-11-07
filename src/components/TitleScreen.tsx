import React from 'react';
import { Trophy, Network, Volume2, VolumeX, Play } from 'lucide-react';

interface TitleScreenProps {
  onStart: () => void;
  highScore: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenMcpBridge: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStart,
  highScore,
  isMuted,
  onToggleMute,
  onOpenMcpBridge,
}) => {
  return (
    <div
      className="fixed inset-0 z-20 flex flex-col justify-between p-8 select-none pointer-events-auto"
      style={{
        background: 'radial-gradient(circle at 50% 40%, rgba(14, 165, 233, 0.12) 0%, rgba(3, 7, 18, 0.75) 75%)',
      }}
    >
      {/* Top Bar Utilities */}
      <div className="flex items-center justify-between w-full max-w-6xl mx-auto">
        {/* High Score Badge */}
        <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg border border-amber-500/30 bg-amber-950/20 text-amber-300">
          <Trophy className="w-4 h-4 text-amber-400" />
          <span className="text-xs uppercase tracking-wider font-semibold">High Score</span>
          <span className="text-sm font-mono font-bold tabular-nums text-amber-200">
            {highScore.toLocaleString()}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenMcpBridge}
            aria-label="Open Astrocade MCP Bridge"
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-sky-300 hover:text-sky-100 bg-sky-950/40 hover:bg-sky-900/50 border border-sky-500/30 rounded-lg transition-colors cursor-pointer"
          >
            <Network className="w-3.5 h-3.5 text-sky-400" />
            <span>Astrocade MCP Bridge</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            className="p-2 rounded-lg border border-slate-700 bg-slate-900/60 text-slate-300 hover:text-white hover:border-slate-500 transition-colors cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Title Lockup over negative space */}
      <div className="flex flex-col items-center justify-center text-center my-auto max-w-2xl mx-auto">
        {/* Bespoke inline SVG Emblem */}
        <div className="mb-6 relative">
          <svg
            className="w-24 h-24 text-sky-400 drop-shadow-[0_0_25px_rgba(56,189,248,0.6)]"
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Outer Hex Ring */}
            <polygon
              points="50,4 90,27 90,73 50,96 10,73 10,27"
              stroke="currentColor"
              strokeWidth="2.5"
              fill="rgba(2, 132, 199, 0.15)"
            />
            {/* Inner Starfighter Silhouette */}
            <path
              d="M50 16 L68 76 L50 64 L32 76 Z"
              fill="url(#emblemGrad)"
              stroke="#38bdf8"
              strokeWidth="2"
            />
            {/* Core Reactor */}
            <circle cx="50" cy="50" r="5" fill="#f59e0b" />
            <defs>
              <linearGradient id="emblemGrad" x1="50" y1="16" x2="50" y2="76" gradientUnits="userSpaceOnUse">
                <stop stopColor="#38bdf8" />
                <stop offset="1" stopColor="#0369a1" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Title Lockup */}
        <h1 className="text-5xl md:text-6xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-b from-white via-sky-100 to-sky-400 drop-shadow-[0_0_20px_rgba(56,189,248,0.4)] uppercase font-mono">
          Astrocade
        </h1>
        <div className="text-sm md:text-base font-semibold tracking-[0.35em] text-sky-400 uppercase mt-2 mb-8">
          Void Vanguard · Sector Combat
        </div>

        {/* Primary Start CTA */}
        <button
          type="button"
          data-start="true"
          onClick={onStart}
          aria-label="Launch Mission"
          className="group relative flex items-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-lg tracking-wider uppercase shadow-[0_0_30px_rgba(56,189,248,0.45)] hover:shadow-[0_0_45px_rgba(56,189,248,0.7)] transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
        >
          <Play className="w-5 h-5 fill-current" />
          <span>Launch Mission</span>
          <span className="text-xs font-mono font-normal opacity-75 ml-2 border border-white/30 px-2 py-0.5 rounded">
            Enter / Space
          </span>
        </button>
      </div>

      {/* Flat Single Control Hint Line in Safe Margin */}
      <div className="w-full text-center pb-2">
        <p className="text-xs md:text-sm text-slate-400 font-mono tracking-wide">
          <span className="text-slate-300 font-semibold">WASD / Arrows</span> Move ·{' '}
          <span className="text-slate-300 font-semibold">Space / Click</span> Fire ·{' '}
          <span className="text-slate-300 font-semibold">Shift</span> Dash ·{' '}
          <span className="text-slate-300 font-semibold">1 · 2 · 3</span> Weapon Select ·{' '}
          <span className="text-slate-300 font-semibold">Esc / P</span> Pause
        </p>
      </div>
    </div>
  );
};
