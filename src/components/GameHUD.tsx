import React from 'react';
import { Volume2, VolumeX, Pause, Shield, Zap, Sparkles, Network } from 'lucide-react';
import { PlayerState, RunStats, WeaponType } from '../game/types';
import { WEAPON_CONFIGS } from '../game/rules';

interface GameHUDProps {
  player: PlayerState;
  stats: RunStats;
  combo: number;
  comboMultiplier: number;
  bossHp: { current: number; max: number } | null;
  isMuted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onSelectWeapon: (weapon: WeaponType) => void;
  onOpenMcpBridge: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  player,
  stats,
  combo,
  comboMultiplier,
  bossHp,
  isMuted,
  onToggleMute,
  onPause,
  onSelectWeapon,
  onOpenMcpBridge,
}) => {
  const isCriticalHp = player.hull <= 1;

  return (
    <div className="fixed inset-0 pointer-events-none z-10 flex flex-col justify-between p-4 md:p-6 select-none">
      {/* Low HP Peripheral Vignette */}
      {isCriticalHp && (
        <div
          className="fixed inset-0 pointer-events-none transition-opacity duration-300 animate-pulse"
          style={{
            boxShadow: 'inset 0 0 100px rgba(239, 68, 68, 0.45)',
          }}
        />
      )}

      {/* Center Aim Crosshair */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-40">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="6" stroke="#38bdf8" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="12" y1="2" x2="12" y2="5" stroke="#38bdf8" strokeWidth="1.5" />
          <line x1="12" y1="19" x2="12" y2="22" stroke="#38bdf8" strokeWidth="1.5" />
          <line x1="2" y1="12" x2="5" y2="12" stroke="#38bdf8" strokeWidth="1.5" />
          <line x1="19" y1="12" x2="22" y2="12" stroke="#38bdf8" strokeWidth="1.5" />
        </svg>
      </div>

      {/* TOP BAR CLUSTER */}
      <div className="flex items-start justify-between w-full">
        {/* Top-Left: Player Hull & Shield Capacitor */}
        <div className="flex flex-col gap-2.5 bg-slate-950/80 border border-slate-800 p-3 rounded-xl min-w-[220px]">
          {/* Hull Vitality Pips */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-300 uppercase">
              <Shield className="w-3.5 h-3.5 text-sky-400" />
              <span>HULL</span>
            </div>
            {/* 4 Discrete Vitality Sockets */}
            <div className="flex items-center gap-1.5">
              {Array.from({ length: player.maxHull }).map((_, idx) => {
                const isFull = idx < player.hull;
                const isDamaged = idx === player.hull;
                return (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-sm border transition-all ${
                      isFull
                        ? 'bg-sky-400 border-sky-300 shadow-[0_0_8px_rgba(56,189,248,0.7)]'
                        : isDamaged
                        ? 'bg-amber-950/60 border-amber-500/60'
                        : 'bg-slate-900 border-slate-700/60'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Shield Capacitor Bar */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px] font-mono font-semibold">
              <span className="text-sky-300">SHIELDS</span>
              <span className="text-sky-200 tabular-nums">{Math.round(player.shields)}%</span>
            </div>
            <div className="w-full h-2 rounded bg-slate-900 border border-slate-800 overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-all duration-75"
                style={{ width: `${Math.max(0, Math.min(100, player.shields))}%` }}
              />
            </div>
          </div>

          {/* Energy Capacitor Bar */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px] font-mono font-semibold">
              <span className="text-amber-400 flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" />
                <span>ENERGY</span>
              </span>
              <span className="text-amber-200 tabular-nums">{Math.round(player.energy)}%</span>
            </div>
            <div className="w-full h-1.5 rounded bg-slate-900 border border-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-75"
                style={{ width: `${Math.max(0, Math.min(100, player.energy))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Top-Center: Score & Combo & Wave */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-4 bg-slate-950/80 border border-slate-800 px-5 py-2.5 rounded-xl text-center">
            {/* Wave */}
            <div className="flex flex-col items-center border-r border-slate-800 pr-4">
              <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400">
                WAVE
              </span>
              <span className="text-lg font-mono font-black tabular-nums text-sky-400">
                {stats.wave} / {stats.maxWave}
              </span>
            </div>

            {/* Score */}
            <div className="flex flex-col items-center">
              <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400">
                SCORE
              </span>
              <span className="text-2xl font-mono font-black tabular-nums text-white tracking-wider">
                {stats.score.toLocaleString()}
              </span>
            </div>

            {/* Combo */}
            {combo > 1 && (
              <div className="flex flex-col items-center border-l border-slate-800 pl-4 animate-bounce">
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-amber-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>COMBO</span>
                </span>
                <span className="text-lg font-mono font-black tabular-nums text-amber-300">
                  {combo}x ({comboMultiplier.toFixed(1)}x)
                </span>
              </div>
            )}
          </div>

          {/* Boss HP Bar (if active) */}
          {bossHp && (
            <div className="w-96 max-w-full mt-3 bg-red-950/70 border border-red-500/60 p-2.5 rounded-lg flex flex-col gap-1.5 animate-pulse">
              <div className="flex items-center justify-between text-xs font-mono font-bold text-red-300">
                <span>SECTOR DREADNOUGHT</span>
                <span className="tabular-nums">
                  {Math.round(bossHp.current)} / {bossHp.max} HP
                </span>
              </div>
              <div className="w-full h-3 bg-slate-950 rounded overflow-hidden border border-red-900">
                <div
                  className="h-full bg-gradient-to-r from-red-600 via-orange-500 to-amber-400 transition-all duration-100"
                  style={{ width: `${Math.max(0, (bossHp.current / bossHp.max) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Top-Right: Quick Utilities */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={onOpenMcpBridge}
            aria-label="Open Astrocade MCP Bridge"
            className="flex items-center gap-1.5 px-3 py-2 bg-sky-950/60 hover:bg-sky-900/70 border border-sky-500/30 text-sky-300 text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            <Network className="w-4 h-4 text-sky-400" />
            <span className="hidden sm:inline">Astrocade MCP</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/80 text-slate-300 hover:text-white hover:border-slate-600 transition-colors cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onPause}
            aria-label="Pause Game"
            className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/80 text-slate-300 hover:text-white hover:border-slate-600 transition-colors cursor-pointer"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* BOTTOM CLUSTER: WEAPON ARSENAL DOCK */}
      <div className="flex justify-center w-full">
        <div className="flex items-center gap-2 bg-slate-950/85 border border-slate-800 p-2 rounded-2xl pointer-events-auto">
          {(['vulcan', 'plasma', 'emp'] as WeaponType[]).map((wKey, idx) => {
            const config = WEAPON_CONFIGS[wKey];
            const isSelected = player.currentWeapon === wKey;
            const hasEnergy = player.energy >= config.energyCost;

            return (
              <button
                key={wKey}
                type="button"
                onClick={() => onSelectWeapon(wKey)}
                aria-label={`Select ${config.name}`}
                className={`flex items-center gap-3 px-3.5 py-2 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-sky-400 bg-sky-950/60 shadow-[0_0_15px_rgba(56,189,248,0.3)]'
                    : 'border-slate-800/80 bg-slate-900/50 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                } ${!hasEnergy ? 'opacity-50' : 'opacity-100'}`}
              >
                {/* Key Badge */}
                <span
                  className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                    isSelected
                      ? 'border-sky-400/80 bg-sky-500/20 text-sky-200'
                      : 'border-slate-700 bg-slate-800 text-slate-400'
                  }`}
                >
                  [{idx + 1}]
                </span>

                {/* Name & Role Clue */}
                <div className="flex flex-col text-left">
                  <span
                    className={`text-xs font-bold font-mono tracking-tight ${
                      isSelected ? 'text-white' : 'text-slate-300'
                    }`}
                  >
                    {config.name}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 hidden md:inline">
                    {config.role}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
