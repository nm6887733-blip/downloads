import { WeaponConfig, WeaponType, WaveConfig, RunStats } from './types';

export const WEAPON_CONFIGS: Record<WeaponType, WeaponConfig> = {
  vulcan: {
    type: 'vulcan',
    name: 'Vulcan Cannon',
    role: 'Rapid Single-Target Kinematics',
    energyCost: 6,
    cooldown: 0.12, // 8 shots per sec
    damage: 22,
    speed: 780,
    radius: 3.5,
    color: '#38bdf8', // Cyan
  },
  plasma: {
    type: 'plasma',
    name: 'Plasma Spreader',
    role: 'Wide 3-Way Tri-Split Crowd Control',
    energyCost: 18,
    cooldown: 0.28,
    damage: 16,
    speed: 650,
    spreadCount: 3,
    spreadAngle: 0.24, // radians (~14 deg)
    radius: 5,
    color: '#a855f7', // Purple/Violet
  },
  emp: {
    type: 'emp',
    name: 'EMP Nova Charge',
    role: 'Heavy Radial Disruption & Armor Breaker',
    energyCost: 45,
    cooldown: 0.85,
    damage: 65,
    speed: 520,
    radius: 9,
    color: '#f59e0b', // Amber/Gold
  },
};

/**
 * Clamps a number between min and max bounds.
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Calculates Euclidean distance between two 2D points.
 */
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Checks if two circles collide.
 */
export function checkCircleCollision(
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2: number
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const radiusSum = r1 + r2;
  return dx * dx + dy * dy <= radiusSum * radiusSum;
}

/**
 * Angle from (x1, y1) to (x2, y2) in radians.
 */
export function angleBetween(x1: number, y1: number, x2: number, y2: number): number {
  return Math.atan2(y2 - y1, x2 - x1);
}

/**
 * Computes score earned given base points and combo count.
 * Multiplier increases every 4 combo hits up to 4.0x.
 */
export function calculateScoreEarned(baseScore: number, combo: number): { score: number; multiplier: number } {
  const multiplier = Math.min(4.0, 1.0 + Math.floor(Math.max(0, combo) / 4) * 0.5);
  const score = Math.round(baseScore * multiplier);
  return { score, multiplier };
}

/**
 * Updates combo state based on hit timing.
 * If elapsed time exceeds comboWindow (default 2.5s), combo drops to 1, else increments.
 */
export function updateCombo(
  currentCombo: number,
  lastHitTime: number,
  currentTime: number,
  comboWindow: number = 2.5
): number {
  if (currentTime - lastHitTime > comboWindow) {
    return 1;
  }
  return currentCombo + 1;
}

/**
 * Calculates weapon firing legality given energy and cooldown.
 */
export function canFireWeapon(
  weaponType: WeaponType,
  currentEnergy: number,
  lastFireTime: number,
  currentTime: number
): { canFire: boolean; requiredEnergy: number; cooldownRemaining: number } {
  const config = WEAPON_CONFIGS[weaponType];
  const cooldownRemaining = Math.max(0, config.cooldown - (currentTime - lastFireTime));
  const canFire = currentEnergy >= config.energyCost && cooldownRemaining <= 0;
  return {
    canFire,
    requiredEnergy: config.energyCost,
    cooldownRemaining,
  };
}

/**
 * Pure damage application logic:
 * Shields absorb damage first. Any remaining spillover damages hull.
 */
export function applyDamageToDefenses(
  hull: number,
  shields: number,
  incomingDamage: number
): {
  remainingHull: number;
  remainingShields: number;
  shieldDamageTaken: number;
  hullDamageTaken: number;
  isFatal: boolean;
} {
  const clampedDamage = Math.max(0, incomingDamage);
  const shieldDamageTaken = Math.min(shields, clampedDamage);
  const remainingShields = shields - shieldDamageTaken;
  const spilloverDamage = clampedDamage - shieldDamageTaken;
  const hullDamageTaken = Math.min(hull, spilloverDamage);
  const remainingHull = Math.max(0, hull - hullDamageTaken);

  return {
    remainingHull,
    remainingShields,
    shieldDamageTaken,
    hullDamageTaken,
    isFatal: remainingHull <= 0,
  };
}

/**
 * Pure shield recharge logic.
 * Shields recharge if player has not taken damage within delay period (default 3.0s).
 */
export function regenerateShields(
  currentShields: number,
  maxShields: number,
  lastDamageTime: number,
  currentTime: number,
  dt: number,
  regenRate: number = 20, // 20 units/sec
  regenDelay: number = 3.0
): number {
  if (currentShields >= maxShields || currentTime - lastDamageTime < regenDelay) {
    return currentShields;
  }
  return Math.min(maxShields, currentShields + regenRate * dt);
}

/**
 * Pure energy regeneration logic.
 */
export function regenerateEnergy(
  currentEnergy: number,
  maxEnergy: number,
  dt: number,
  regenRate: number = 35 // 35 units/sec
): number {
  return Math.min(maxEnergy, currentEnergy + regenRate * dt);
}

/**
 * Wave configuration generator for waves 1 to 5 (Wave 5 is Sector Boss).
 */
export function getWaveConfig(wave: number): WaveConfig {
  const clampedWave = Math.max(1, wave);
  if (clampedWave === 1) {
    return {
      wave: 1,
      swarmers: 8,
      kiters: 0,
      chargers: 0,
      hasBoss: false,
      spawnInterval: 1.4,
      speedMultiplier: 1.0,
      hpMultiplier: 1.0,
    };
  }
  if (clampedWave === 2) {
    return {
      wave: 2,
      swarmers: 10,
      kiters: 4,
      chargers: 0,
      hasBoss: false,
      spawnInterval: 1.2,
      speedMultiplier: 1.1,
      hpMultiplier: 1.15,
    };
  }
  if (clampedWave === 3) {
    return {
      wave: 3,
      swarmers: 12,
      kiters: 6,
      chargers: 3,
      hasBoss: false,
      spawnInterval: 1.0,
      speedMultiplier: 1.2,
      hpMultiplier: 1.3,
    };
  }
  if (clampedWave === 4) {
    return {
      wave: 4,
      swarmers: 14,
      kiters: 8,
      chargers: 5,
      hasBoss: false,
      spawnInterval: 0.85,
      speedMultiplier: 1.3,
      hpMultiplier: 1.45,
    };
  }
  // Wave 5+: Sector Dreadnought Boss Encounter
  return {
    wave: clampedWave,
    swarmers: 8,
    kiters: 4,
    chargers: 2,
    hasBoss: true,
    spawnInterval: 1.8,
    speedMultiplier: 1.35,
    hpMultiplier: 1.6,
  };
}

/**
 * Computes accuracy percentage.
 */
export function calculateAccuracy(shotsFired: number, shotsHit: number): number {
  if (shotsFired <= 0) return 0;
  return Math.round((shotsHit / shotsFired) * 100);
}

/**
 * Generates an Astrocade MCP export schema compatible with https://mcp.astrocade.com/mcp
 */
export function generateAstrocadeManifest(stats: RunStats, version: string = '1.0.0') {
  return {
    astrocade_protocol: 'mcp-game-manifest/v1',
    server_endpoint: 'https://mcp.astrocade.com/mcp',
    game_id: 'astrocade-void-vanguard',
    title: 'Astrocade: Void Vanguard',
    genre: 'sci-fi-arcade-shooter',
    version,
    compatibility: {
      webgl: false, // 2D canvas optimized, no GPU dependencies
      input: ['keyboard', 'mouse', 'touch'],
      aspect_ratio: 'viewport-fluid',
      target_fps: 60,
    },
    mechanics: {
      weapons: ['vulcan', 'plasma', 'emp'],
      boss_encounters: true,
      procedural_audio: 'web-audio-synth',
      sim_hitstop_ms: 50,
    },
    run_telemetry: {
      score: stats.score,
      high_score: stats.highScore,
      wave_cleared: stats.wave,
      max_wave: stats.maxWave,
      enemies_vaporized: stats.kills,
      accuracy_pct: calculateAccuracy(stats.shotsFired, stats.shotsHit),
      max_combo: stats.maxCombo,
      combat_duration_s: Math.round(stats.timeElapsed),
    },
    published_at: new Date().toISOString(),
  };
}
