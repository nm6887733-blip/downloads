import React from 'react';
import { Play, RotateCcw, Home, Award, AlertTriangle, ShieldCheck, Crosshair, Network } from 'lucide-react';
import { GamePhase, GameOutcome, RunStats } from '../game/types';
import { calculateAccuracy } from '../game/rules';

interface GameModalProps {
  phase: GamePhase;
  outcome: GameOutcome;
  stats: RunStats;
  bossHp: { current: number; max: number } | null;
  onResume: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
  onOpenMcpBridge: () => void;
}

export const GameModal: React.FC<GameModalProps> = ({
  phase,
  outcome,
  stats,
  bossHp,
  onResume,
  onRestart,
  onReturnTitle,
  onOpenMcpBridge,
}) => {
  if (phase !== 'paused' && phase !== 'gameover') {
    return null;
  }

  const isPaused = phase === 'paused';
  const isVictory = outcome === 'victory';
  const accuracy = calculateAccuracy(stats.shotsFired, stats.shotsHit);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-slate-950/80 pointer-events-auto select-none">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl flex flex-col gap-6 text-slate-100">
        {/* Header Lockup */}
        <div className="flex flex-col items-center text-center">
          {isPaused ? (
            <>
              <div className="w-12 h-12 rounded-xl bg-sky-950/60 border border-sky-500/40 flex items-center justify-center text-sky-400 mb-3">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h2 className="text-3xl font-black font-mono tracking-wider text-white uppercase">
                Mission Paused
              </h2>
              <p className="text-xs font-mono text-slate-400 mt-1">Tactical Hold · Sector ASTROCADE-9</p>
            </>
          ) : isVictory ? (
            <>
              <div className="w-14 h-14 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 flex items-center justify-center text-emerald-400 mb-3 shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                <Award className="w-8 h-8" />
              </div>
              <h2 className="text-3xl md:text-4xl font-black font-mono tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 uppercase">
                Sector Liberated!
              </h2>
              <p className="text-xs font-mono text-emerald-400/90 mt-1 font-bold">
                Astrocade Vanguard Victory · All Hostile Drones & Dreadnought Vaporized
              </p>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-2xl bg-red-950/80 border border-red-500/50 flex items-center justify-center text-red-400 mb-3 shadow-[0_0_20px_rgba(239,68,68,0.4)]">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h2 className="text-3xl md:text-4xl font-black font-mono tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-rose-300 to-orange-400 uppercase">
                Hull Breached
              </h2>
              <p className="text-xs font-mono text-red-400/90 mt-1 font-bold">
                Starfighter Compromised · Emergency Telemetry Cached
              </p>
            </>
          )}
        </div>

        {/* Tabular Numerals Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400">
              Final Score
            </span>
            <span className="text-xl font-mono font-black tabular-nums text-white">
              {stats.score.toLocaleString()}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400">
              High Score
            </span>
            <span className="text-xl font-mono font-black tabular-nums text-amber-400">
              {stats.highScore.toLocaleString()}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400">
              Wave Reached
            </span>
            <span className="text-xl font-mono font-black tabular-nums text-sky-400">
              {stats.wave} / {stats.maxWave}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400">
              Enemies Defeated
            </span>
            <span className="text-xl font-mono font-black tabular-nums text-emerald-400">
              {stats.kills}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400">
              Firing Accuracy
            </span>
            <span className="text-xl font-mono font-black tabular-nums text-purple-400 flex items-center gap-1">
              <Crosshair className="w-3.5 h-3.5" />
              <span>{accuracy}%</span>
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400">
              Combat Time
            </span>
            <span className="text-xl font-mono font-black tabular-nums text-slate-200">
              {Math.round(stats.timeElapsed)}s
            </span>
          </div>
        </div>

        {/* If Boss was fought but not killed */}
        {!isVictory && bossHp && (
          <div className="bg-red-950/40 border border-red-500/30 p-3 rounded-lg text-xs font-mono text-red-300 flex justify-between items-center">
            <span>Dreadnought Damage:</span>
            <span className="font-bold tabular-nums">
              {Math.round(((bossHp.max - bossHp.current) / bossHp.max) * 100)}% Depleted
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5 pt-2">
          {isPaused ? (
            <button
              type="button"
              data-start="true"
              onClick={onResume}
              aria-label="Resume Mission"
              className="flex items-center justify-center gap-2 w-full py-3.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-base tracking-wider uppercase shadow-[0_0_20px_rgba(56,189,248,0.4)] transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Resume Mission [Esc]</span>
            </button>
          ) : (
            <button
              type="button"
              data-start="true"
              onClick={onRestart}
              aria-label={isVictory ? 'Play Again' : 'Try Again'}
              className="flex items-center justify-center gap-2 w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-base tracking-wider uppercase shadow-[0_0_25px_rgba(56,189,248,0.4)] transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{isVictory ? 'Play Again' : 'Try Again'}</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRestart}
              aria-label="Restart Mission"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 hover:border-slate-500 text-slate-300 font-semibold text-xs tracking-wider uppercase transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restart</span>
            </button>

            <button
              type="button"
              onClick={onOpenMcpBridge}
              aria-label="Astrocade MCP Bridge"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-sky-500/40 bg-sky-950/40 hover:bg-sky-900/50 text-sky-300 font-semibold text-xs tracking-wider uppercase transition-colors cursor-pointer"
            >
              <Network className="w-3.5 h-3.5" />
              <span>Astrocade MCP</span>
            </button>

            <button
              type="button"
              onClick={onReturnTitle}
              aria-label="Return to Title"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 hover:border-slate-500 text-slate-300 font-semibold text-xs tracking-wider uppercase transition-colors cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Title</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
