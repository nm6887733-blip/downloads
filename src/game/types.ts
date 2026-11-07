export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export type GameOutcome = 'victory' | 'defeat' | null;

export type WeaponType = 'vulcan' | 'plasma' | 'emp';

export type EnemyType = 'swarmer' | 'kiter' | 'charger' | 'boss';

export type PowerupType = 'shield' | 'overcharge' | 'speed' | 'emp';

export interface WeaponConfig {
  type: WeaponType;
  name: string;
  role: string;
  energyCost: number;
  cooldown: number; // in seconds
  damage: number;
  speed: number;
  spreadCount?: number;
  spreadAngle?: number;
  radius: number;
  color: string;
}

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  hull: number;
  maxHull: number;
  shields: number;
  maxShields: number;
  energy: number;
  maxEnergy: number;
  energyRegenRate: number;
  currentWeapon: WeaponType;
  dashCooldownTimer: number;
  dashDurationTimer: number;
  isDashing: boolean;
  dashSpeedBonus: number;
  invincibleTimer: number;
  lastDamageTime: number;
  squashX: number;
  squashY: number;
}

export interface Enemy {
  id: number;
  type: EnemyType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  hitFlashTimer: number;
  telegraphTimer: number; // for chargers/bosses
  maxTelegraph: number;
  isCharging?: boolean;
  chargeDirection?: { x: number; y: number };
  attackCooldown: number;
  scoreValue: number;
  color: string;
  phase?: number; // for boss
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  isPlayer: boolean;
  color: string;
  life: number;
  maxLife: number;
  weaponType?: WeaponType;
}

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
  alpha: number;
}

export interface Powerup {
  id: number;
  type: PowerupType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  pulse: number;
}

export interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  brightness: number;
  layer: number;
}

export interface RunStats {
  score: number;
  highScore: number;
  wave: number;
  maxWave: number;
  kills: number;
  shotsFired: number;
  shotsHit: number;
  maxCombo: number;
  timeElapsed: number;
  damageTaken: number;
}

export interface WaveConfig {
  wave: number;
  swarmers: number;
  kiters: number;
  chargers: number;
  hasBoss: boolean;
  spawnInterval: number;
  speedMultiplier: number;
  hpMultiplier: number;
}
