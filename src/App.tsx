/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from './game/engine';
import { GamePhase, GameOutcome, PlayerState, RunStats, WeaponType } from './game/types';
import { TitleScreen } from './components/TitleScreen';
import { GameHUD } from './components/GameHUD';
import { GameModal } from './components/GameModal';
import { AstrocadeBridgeModal } from './components/AstrocadeBridgeModal';
import { sound } from './game/audio';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // Discrete Phase & HUD State
  const [phase, setPhase] = useState<GamePhase>('title');
  const [outcome, setOutcome] = useState<GameOutcome>(null);
  const [isMuted, setIsMuted] = useState<boolean>(() => sound.getMuted());
  const [isMcpBridgeOpen, setIsMcpBridgeOpen] = useState<boolean>(false);

  // Throttled HUD State
  const [playerState, setPlayerState] = useState<PlayerState>({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    hull: 4,
    maxHull: 4,
    shields: 100,
    maxShields: 100,
    energy: 100,
    maxEnergy: 100,
    energyRegenRate: 35,
    currentWeapon: 'vulcan',
    dashCooldownTimer: 0,
    dashDurationTimer: 0,
    isDashing: false,
    dashSpeedBonus: 450,
    invincibleTimer: 0,
    lastDamageTime: 0,
    squashX: 1,
    squashY: 1,
  });

  const [stats, setStats] = useState<RunStats>({
    score: 0,
    highScore: 0,
    wave: 1,
    maxWave: 5,
    kills: 0,
    shotsFired: 0,
    shotsHit: 0,
    maxCombo: 0,
    timeElapsed: 0,
    damageTaken: 0,
  });

  const [combo, setCombo] = useState<number>(0);
  const [comboMultiplier, setComboMultiplier] = useState<number>(1.0);
  const [bossHp, setBossHp] = useState<{ current: number; max: number } | null>(null);

  // Initialize engine once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check ?autostart=1
    const params = new URLSearchParams(window.location.search);
    const autostart = params.get('autostart') === '1';

    const engine = new GameEngine(canvas, {
      onPhaseChange: (newPhase, newOutcome) => {
        setPhase(newPhase);
        setOutcome(newOutcome);
      },
      onStatsUpdate: (newStats) => {
        setStats(newStats);
      },
      onPlayerUpdate: (newPlayer) => {
        setPlayerState(newPlayer);
      },
      onComboUpdate: (newCombo, newMultiplier) => {
        setCombo(newCombo);
        setComboMultiplier(newMultiplier);
      },
      onBossHpUpdate: (hp) => {
        setBossHp(hp);
      },
    });

    engineRef.current = engine;
    engine.startLoop();

    if (autostart) {
      engine.startGame();
    } else {
      document.body.dataset.state = 'title';
    }

    const onResize = () => {
      engine.handleResize();
    };

    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      engine.stopLoop();
    };
  }, []);

  const handleStart = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.startGame();
    }
  }, []);

  const handleResume = useCallback(() => {
    if (engineRef.current && phase === 'paused') {
      engineRef.current.togglePause();
    }
  }, [phase]);

  const handlePause = useCallback(() => {
    if (engineRef.current && phase === 'playing') {
      engineRef.current.togglePause();
    }
  }, [phase]);

  const handleRestart = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.startGame();
    }
  }, []);

  const handleReturnTitle = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.returnToTitle();
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  }, []);

  const handleSelectWeapon = useCallback((weapon: WeaponType) => {
    if (engineRef.current) {
      engineRef.current.setWeapon(weapon);
    }
  }, []);

  return (
    <main
      className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans"
      data-testid="game-shell"
    >
      {/* Isolated Canvas Mount (decopled from React HUD updates) */}
      <canvas
        ref={canvasRef}
        data-testid="game-canvas"
        className="absolute inset-0 w-full h-full block cursor-crosshair z-0"
      />

      {/* Screen: Title Overlay */}
      {phase === 'title' && (
        <TitleScreen
          onStart={handleStart}
          highScore={stats.highScore}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onOpenMcpBridge={() => setIsMcpBridgeOpen(true)}
        />
      )}

      {/* Screen: Live HUD during Playing */}
      {phase === 'playing' && (
        <GameHUD
          player={playerState}
          stats={stats}
          combo={combo}
          comboMultiplier={comboMultiplier}
          bossHp={bossHp}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onPause={handlePause}
          onSelectWeapon={handleSelectWeapon}
          onOpenMcpBridge={() => setIsMcpBridgeOpen(true)}
        />
      )}

      {/* Screen: Status Modals (Paused / Victory / Game Over) */}
      <GameModal
        phase={phase}
        outcome={outcome}
        stats={stats}
        bossHp={bossHp}
        onResume={handleResume}
        onRestart={handleRestart}
        onReturnTitle={handleReturnTitle}
        onOpenMcpBridge={() => setIsMcpBridgeOpen(true)}
      />

      {/* Astrocade MCP Bridge Information & Manifest Exporter Modal */}
      <AstrocadeBridgeModal
        isOpen={isMcpBridgeOpen}
        onClose={() => setIsMcpBridgeOpen(false)}
        stats={stats}
      />
    </main>
  );
}
