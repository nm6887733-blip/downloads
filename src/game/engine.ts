import {
  GamePhase,
  GameOutcome,
  PlayerState,
  Enemy,
  Projectile,
  Particle,
  Powerup,
  Star,
  RunStats,
  WeaponType,
  WaveConfig,
} from './types';
import {
  clamp,
  distance,
  checkCircleCollision,
  angleBetween,
  calculateScoreEarned,
  updateCombo,
  canFireWeapon,
  applyDamageToDefenses,
  regenerateShields,
  regenerateEnergy,
  getWaveConfig,
  WEAPON_CONFIGS,
} from './rules';
import { sound } from './audio';

const PARTICLE_POOL_SIZE = 400;

export interface EngineCallbacks {
  onPhaseChange: (phase: GamePhase, outcome: GameOutcome) => void;
  onStatsUpdate: (stats: RunStats) => void;
  onPlayerUpdate: (player: PlayerState) => void;
  onComboUpdate: (combo: number, multiplier: number) => void;
  onBossHpUpdate: (bossHp: { current: number; max: number } | null) => void;
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private callbacks: EngineCallbacks;

  // Running state
  private isRunning: boolean = false;
  private animFrameId: number | null = null;
  private lastTime: number = 0;
  private gameTime: number = 0;

  // Game flow
  public phase: GamePhase = 'title';
  public outcome: GameOutcome = null;

  // Clamped dt & hitstop
  private hitstopTimer: number = 0;
  private cameraTrauma: number = 0;

  // Input states
  private keysHeld: Map<string, boolean> = new Map();
  private keysJustPressed: Set<string> = new Set();
  private mousePos: { x: number; y: number } = { x: 0, y: 0 };
  private isMouseDown: boolean = false;

  // Entities
  private player!: PlayerState;
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private powerups: Powerup[] = [];
  private particles: Particle[] = [];
  private particleIndex: number = 0;
  private stars: Star[] = [];

  // Progression & Encounter State
  private currentWaveNumber: number = 1;
  private enemiesSpawnedThisWave: { swarmers: number; kiters: number; chargers: number; boss: boolean } = {
    swarmers: 0,
    kiters: 0,
    chargers: 0,
    boss: false,
  };
  private waveSpawnTimer: number = 0;
  private nextEntityId: number = 1;

  // Combat Stats
  private stats: RunStats = {
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
  };

  private currentCombo: number = 0;
  private lastHitTime: number = 0;
  private lastFireTime: number = 0;
  private overchargeTimer: number = 0;

  // Throttle updates to React HUD
  private lastHudDispatchTime: number = 0;

  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not acquire 2D canvas context');
    this.ctx = context;
    this.callbacks = callbacks;

    // Load saved high score
    if (typeof window !== 'undefined') {
      const savedHigh = localStorage.getItem('astrocade_highscore');
      if (savedHigh) {
        this.stats.highScore = parseInt(savedHigh, 10) || 0;
      }
    }

    this.initParticlePool();
    this.initStars();
    this.resetPlayer();
    this.bindInputs();
    this.handleResize();
  }

  private initParticlePool() {
    this.particles = [];
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 2,
        life: 0,
        maxLife: 1,
        color: '#ffffff',
        alpha: 1,
      });
    }
  }

  private initStars() {
    const width = this.canvas.width || 1280;
    const height = this.canvas.height || 800;
    this.stars = [];
    for (let i = 0; i < 180; i++) {
      const layer = Math.random() < 0.6 ? 1 : Math.random() < 0.85 ? 2 : 3;
      this.stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: layer === 1 ? 1 : layer === 2 ? 1.8 : 2.6,
        speed: layer * 32,
        brightness: layer === 1 ? 0.35 : layer === 2 ? 0.65 : 0.95,
        layer,
      });
    }
  }

  private resetPlayer() {
    const cx = (this.canvas.width || 1280) / 2;
    const cy = ((this.canvas.height || 800) * 3) / 4;
    this.player = {
      x: cx,
      y: cy,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2, // Facing UP
      hull: 4, // 4 discrete pips
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
      lastDamageTime: -999,
      squashX: 1,
      squashY: 1,
    };
  }

  public handleResize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Re-seed stars across full width if needed
    if (this.stars.length === 0 || this.stars[0].x < rect.width * 0.5) {
      for (const s of this.stars) {
        s.x = Math.random() * rect.width;
        s.y = Math.random() * rect.height;
      }
    }
  }

  private bindInputs() {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      // Prevent scrolling on Space / Arrow keys
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        e.preventDefault();
      }

      if (!this.keysHeld.get(key)) {
        this.keysJustPressed.add(key);
      }
      this.keysHeld.set(key, true);

      // Global hotkeys
      if (key === 'm') {
        sound.toggleMute();
      }

      // Start triggers from Title
      if (this.phase === 'title' && (key === 'enter' || key === ' ')) {
        this.startGame();
      }

      // Pause triggers
      if ((key === 'escape' || key === 'p') && (this.phase === 'playing' || this.phase === 'paused')) {
        this.togglePause();
      }

      // Weapon hotkeys
      if (key === '1') this.player.currentWeapon = 'vulcan';
      if (key === '2') this.player.currentWeapon = 'plasma';
      if (key === '3') this.player.currentWeapon = 'emp';
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      this.keysHeld.set(key, false);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mousePos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        this.isMouseDown = true;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        this.isMouseDown = false;
      }
    };

    const handleBlur = () => {
      // Clear all held inputs on blur so keys never stick
      this.keysHeld.clear();
      this.keysJustPressed.clear();
      this.isMouseDown = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleBlur);
  }

  public setWeapon(w: WeaponType) {
    if (this.player) {
      this.player.currentWeapon = w;
      this.callbacks.onPlayerUpdate({ ...this.player });
    }
  }

  public startGame() {
    this.phase = 'playing';
    this.outcome = null;
    document.body.dataset.state = 'playing';

    this.resetPlayer();
    this.enemies = [];
    this.projectiles = [];
    this.powerups = [];
    this.currentWaveNumber = 1;
    this.enemiesSpawnedThisWave = { swarmers: 0, kiters: 0, chargers: 0, boss: false };
    this.waveSpawnTimer = 0.5;
    this.currentCombo = 0;
    this.overchargeTimer = 0;
    this.stats = {
      score: 0,
      highScore: this.stats.highScore,
      wave: 1,
      maxWave: 5,
      kills: 0,
      shotsFired: 0,
      shotsHit: 0,
      maxCombo: 0,
      timeElapsed: 0,
      damageTaken: 0,
    };

    this.callbacks.onPhaseChange(this.phase, this.outcome);
    this.callbacks.onStatsUpdate({ ...this.stats });
    this.callbacks.onPlayerUpdate({ ...this.player });
    this.callbacks.onBossHpUpdate(null);

    // Initial thruster burst
    sound.playDash();
  }

  public togglePause() {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      document.body.dataset.state = 'paused';
    } else if (this.phase === 'paused') {
      this.phase = 'playing';
      document.body.dataset.state = 'playing';
      this.lastTime = performance.now();
    }
    this.callbacks.onPhaseChange(this.phase, this.outcome);
  }

  public returnToTitle() {
    this.phase = 'title';
    this.outcome = null;
    document.body.dataset.state = 'title';
    this.callbacks.onPhaseChange(this.phase, this.outcome);
    this.callbacks.onBossHpUpdate(null);
  }

  public startLoop() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();

    const loop = (timestamp: number) => {
      const rawDt = (timestamp - this.lastTime) / 1000;
      this.lastTime = timestamp;

      // Clamped frame delta time <= 0.05s
      const dt = Math.min(rawDt, 0.05);

      this.update(dt);
      this.render();

      // Clear edge triggers at end of frame
      this.keysJustPressed.clear();

      if (this.isRunning) {
        this.animFrameId = requestAnimationFrame(loop);
      }
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  public stopLoop() {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private triggerHitstop(duration: number) {
    this.hitstopTimer = Math.max(this.hitstopTimer, duration);
  }

  private addTrauma(amount: number) {
    this.cameraTrauma = Math.min(1.0, this.cameraTrauma + amount);
  }

  private spawnParticle(
    x: number,
    y: number,
    vx: number,
    vy: number,
    size: number,
    life: number,
    color: string
  ) {
    const p = this.particles[this.particleIndex];
    this.particleIndex = (this.particleIndex + 1) % PARTICLE_POOL_SIZE;

    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.size = size;
    p.life = life;
    p.maxLife = life;
    p.color = color;
    p.alpha = 1;
  }

  private spawnBurst(x: number, y: number, count: number, color: string, speedBase: number = 180) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = (0.3 + Math.random() * 0.9) * speedBase;
      const size = 1.5 + Math.random() * 3.5;
      const life = 0.25 + Math.random() * 0.45;
      this.spawnParticle(x, y, Math.cos(ang) * spd, Math.sin(ang) * spd, size, life, color);
    }
  }

  private update(dt: number) {
    this.gameTime += dt;
    const viewWidth = this.canvas.getBoundingClientRect().width || 1280;
    const viewHeight = this.canvas.getBoundingClientRect().height || 800;

    // Camera shake decay (decaying trauma * trauma)
    if (this.cameraTrauma > 0) {
      this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 2.2);
    }

    // Always update stars (ambient tour in Title, warp in Playing)
    const starSpeedFactor = this.phase === 'playing' ? (this.player.isDashing ? 3.0 : 1.2) : 0.6;
    for (const s of this.stars) {
      s.y += s.speed * starSpeedFactor * dt;
      if (s.y > viewHeight) {
        s.y = 0;
        s.x = Math.random() * viewWidth;
      }
    }

    // Always update active particles in real dt (even during hitstop)
    for (const p of this.particles) {
      if (!p.active) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) {
        p.active = false;
      }
    }

    // Title mode: subtle starship auto-hover in centerpiece
    if (this.phase === 'title') {
      this.player.x = viewWidth / 2;
      this.player.y = (viewHeight * 3) / 4 + 10 + Math.sin(this.gameTime * 2) * 10;
      this.player.angle = -Math.PI / 2 + Math.cos(this.gameTime * 1.5) * 0.08;
      return;
    }

    if (this.phase !== 'playing') {
      return;
    }

    // Simulation Hitstop: if hitstop is active, pause entity kinematics
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      return;
    }

    this.stats.timeElapsed += dt;

    // Overcharge timer
    if (this.overchargeTimer > 0) {
      this.overchargeTimer -= dt;
    }

    // Update Player
    this.updatePlayer(dt, viewWidth, viewHeight);

    // Update Projectiles
    this.updateProjectiles(dt, viewWidth, viewHeight);

    // Update Enemies & Wave progression
    this.updateEnemies(dt, viewWidth, viewHeight);

    // Update Powerups
    this.updatePowerups(dt, viewHeight);

    // Check Collisions
    this.checkCollisions();

    // Check Wave / Boss Win Condition
    this.checkWaveProgress();

    // Throttle React HUD updates (every 100ms or on important threshold)
    if (this.gameTime - this.lastHudDispatchTime > 0.09) {
      this.lastHudDispatchTime = this.gameTime;
      this.callbacks.onStatsUpdate({ ...this.stats });
      this.callbacks.onPlayerUpdate({ ...this.player });
      const boss = this.enemies.find((e) => e.type === 'boss');
      this.callbacks.onBossHpUpdate(boss ? { current: boss.hp, max: boss.maxHp } : null);
    }
  }

  private updatePlayer(dt: number, width: number, height: number) {
    const p = this.player;

    // Regeneration
    p.shields = regenerateShields(p.shields, p.maxShields, p.lastDamageTime, this.gameTime, dt);
    p.energy = regenerateEnergy(
      p.energy,
      p.maxEnergy,
      dt,
      this.overchargeTimer > 0 ? 120 : p.energyRegenRate
    );

    // Timers
    if (p.dashCooldownTimer > 0) p.dashCooldownTimer -= dt;
    if (p.invincibleTimer > 0) p.invincibleTimer -= dt;

    // Dashing
    if (p.dashDurationTimer > 0) {
      p.dashDurationTimer -= dt;
      if (p.dashDurationTimer <= 0) {
        p.isDashing = false;
      }
    }

    // Dash Action (Shift or Space or Double Tap)
    const wantsDash = this.keysJustPressed.has('shift') || this.keysJustPressed.has('c');
    if (wantsDash && p.dashCooldownTimer <= 0 && p.energy >= 20) {
      p.isDashing = true;
      p.dashDurationTimer = 0.18;
      p.dashCooldownTimer = 0.9;
      p.energy -= 20;
      sound.playDash();
      this.addTrauma(0.18);

      // Dash squash & stretch
      p.squashX = 0.7;
      p.squashY = 1.35;

      // Dash particles
      this.spawnBurst(p.x, p.y + 15, 12, '#38bdf8', 220);
    }

    // Movement intent
    let moveX = 0;
    let moveY = 0;
    if (this.keysHeld.get('a') || this.keysHeld.get('arrowleft')) moveX -= 1;
    if (this.keysHeld.get('d') || this.keysHeld.get('arrowright')) moveX += 1;
    if (this.keysHeld.get('w') || this.keysHeld.get('arrowup')) moveY -= 1;
    if (this.keysHeld.get('s') || this.keysHeld.get('arrowdown')) moveY += 1;

    // Normalize diagonal
    if (moveX !== 0 && moveY !== 0) {
      moveX *= 0.7071;
      moveY *= 0.7071;
    }

    const baseSpeed = p.isDashing ? 680 : 340;
    const accel = p.isDashing ? 3200 : 1800;
    const friction = p.isDashing ? 0.96 : 0.88;

    p.vx += moveX * accel * dt;
    p.vy += moveY * accel * dt;
    p.vx *= friction;
    p.vy *= friction;

    // Clamp max velocity
    const currentSpeed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    if (currentSpeed > baseSpeed) {
      p.vx = (p.vx / currentSpeed) * baseSpeed;
      p.vy = (p.vy / currentSpeed) * baseSpeed;
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Keep inside viewport with margin
    p.x = clamp(p.x, 24, width - 24);
    p.y = clamp(p.y, 24, height - 24);

    // Aiming towards mouse or forward
    if (this.mousePos.x > 0 && this.mousePos.y > 0) {
      p.angle = angleBetween(p.x, p.y, this.mousePos.x, this.mousePos.y);
    } else if (moveX !== 0 || moveY !== 0) {
      p.angle = Math.atan2(moveY, moveX);
    }

    // Squash & stretch damping back to 1.0
    p.squashX += (1 - p.squashX) * dt * 10;
    p.squashY += (1 - p.squashY) * dt * 10;

    // Engine exhaust particles
    if (Math.random() < 0.75) {
      const exhaustAngle = p.angle + Math.PI + (Math.random() - 0.5) * 0.4;
      const speed = p.isDashing ? 280 : 120;
      this.spawnParticle(
        p.x - Math.cos(p.angle) * 16,
        p.y - Math.sin(p.angle) * 16,
        Math.cos(exhaustAngle) * speed,
        Math.sin(exhaustAngle) * speed,
        p.isDashing ? 3 : 1.8,
        0.2,
        p.isDashing ? '#38bdf8' : '#f59e0b'
      );
    }

    // Weapon firing (Space, Mouse Click, or Enter)
    const wantsFire = this.isMouseDown || this.keysHeld.get(' ') || this.keysHeld.get('j');
    if (wantsFire) {
      this.firePlayerWeapon();
    }
  }

  private firePlayerWeapon() {
    const p = this.player;
    const config = WEAPON_CONFIGS[p.currentWeapon];
    const effectiveCost = this.overchargeTimer > 0 ? 0 : config.energyCost;

    const check = canFireWeapon(p.currentWeapon, p.energy, this.lastFireTime, this.gameTime);
    if (!check.canFire && this.overchargeTimer <= 0) return;

    // Fire!
    this.lastFireTime = this.gameTime;
    p.energy -= effectiveCost;
    this.stats.shotsFired++;

    const spawnDist = 18;
    const spawnX = p.x + Math.cos(p.angle) * spawnDist;
    const spawnY = p.y + Math.sin(p.angle) * spawnDist;

    if (p.currentWeapon === 'vulcan') {
      sound.playLaser();
      this.projectiles.push({
        id: this.nextEntityId++,
        x: spawnX,
        y: spawnY,
        vx: Math.cos(p.angle) * config.speed,
        vy: Math.sin(p.angle) * config.speed,
        radius: config.radius,
        damage: config.damage,
        isPlayer: true,
        color: config.color,
        life: 1.6,
        maxLife: 1.6,
        weaponType: 'vulcan',
      });
      // Recoil
      p.vx -= Math.cos(p.angle) * 20;
      p.vy -= Math.sin(p.angle) * 20;
    } else if (p.currentWeapon === 'plasma') {
      sound.playPlasma();
      const spreadCount = config.spreadCount || 3;
      const spreadAngle = config.spreadAngle || 0.24;
      const startAngle = p.angle - spreadAngle * ((spreadCount - 1) / 2);

      for (let i = 0; i < spreadCount; i++) {
        const a = startAngle + i * spreadAngle;
        this.projectiles.push({
          id: this.nextEntityId++,
          x: spawnX,
          y: spawnY,
          vx: Math.cos(a) * config.speed,
          vy: Math.sin(a) * config.speed,
          radius: config.radius,
          damage: config.damage,
          isPlayer: true,
          color: config.color,
          life: 1.8,
          maxLife: 1.8,
          weaponType: 'plasma',
        });
      }
      p.vx -= Math.cos(p.angle) * 45;
      p.vy -= Math.sin(p.angle) * 45;
    } else if (p.currentWeapon === 'emp') {
      sound.playEmp();
      this.addTrauma(0.22);
      this.projectiles.push({
        id: this.nextEntityId++,
        x: spawnX,
        y: spawnY,
        vx: Math.cos(p.angle) * config.speed,
        vy: Math.sin(p.angle) * config.speed,
        radius: config.radius,
        damage: config.damage,
        isPlayer: true,
        color: config.color,
        life: 2.2,
        maxLife: 2.2,
        weaponType: 'emp',
      });
      p.vx -= Math.cos(p.angle) * 90;
      p.vy -= Math.sin(p.angle) * 90;
    }
  }

  private updateProjectiles(dt: number, width: number, height: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      proj.life -= dt;

      // Projectile particle trail
      if (Math.random() < 0.35) {
        this.spawnParticle(
          proj.x,
          proj.y,
          -proj.vx * 0.1,
          -proj.vy * 0.1,
          proj.radius * 0.6,
          0.15,
          proj.color
        );
      }

      // Out of bounds or expired
      if (
        proj.life <= 0 ||
        proj.x < -40 ||
        proj.x > width + 40 ||
        proj.y < -40 ||
        proj.y > height + 40
      ) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  private updateEnemies(dt: number, width: number, height: number) {
    const wave = getWaveConfig(this.currentWaveNumber);

    // Spawning waves
    this.waveSpawnTimer -= dt;
    if (this.waveSpawnTimer <= 0) {
      this.waveSpawnTimer = wave.spawnInterval;
      this.trySpawnEnemy(wave, width);
    }

    // Update existing enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.hitFlashTimer > 0) e.hitFlashTimer -= dt;

      const distToPlayer = distance(e.x, e.y, this.player.x, this.player.y);
      const angleToPlayer = angleBetween(e.x, e.y, this.player.x, this.player.y);

      // AI Archetype Behaviors:
      if (e.type === 'swarmer') {
        // Fast interceptor: moves directly towards player with weaving
        const weave = Math.sin(this.gameTime * 4 + e.id) * 60;
        e.angle = angleToPlayer;
        e.vx = Math.cos(angleToPlayer) * e.speed + Math.cos(angleToPlayer + Math.PI / 2) * weave;
        e.vy = Math.sin(angleToPlayer) * e.speed + Math.sin(angleToPlayer + Math.PI / 2) * weave;
      } else if (e.type === 'kiter') {
        // Ranged standoff: stays 260-380px away from player
        e.angle = angleToPlayer;
        e.attackCooldown -= dt;

        if (distToPlayer < 240) {
          // Back away!
          e.vx = -Math.cos(angleToPlayer) * e.speed;
          e.vy = -Math.sin(angleToPlayer) * e.speed;
        } else if (distToPlayer > 380) {
          // Close in
          e.vx = Math.cos(angleToPlayer) * e.speed * 0.8;
          e.vy = Math.sin(angleToPlayer) * e.speed * 0.8;
        } else {
          // Circle flank
          e.vx = Math.cos(angleToPlayer + Math.PI / 2) * e.speed * 0.6;
          e.vy = Math.sin(angleToPlayer + Math.PI / 2) * e.speed * 0.6;
        }

        // Fire homing / straight energy bolts
        if (e.attackCooldown <= 0 && distToPlayer < 500) {
          e.attackCooldown = 2.0;
          sound.playLaser(0.65);
          this.projectiles.push({
            id: this.nextEntityId++,
            x: e.x + Math.cos(angleToPlayer) * 16,
            y: e.y + Math.sin(angleToPlayer) * 16,
            vx: Math.cos(angleToPlayer) * 320,
            vy: Math.sin(angleToPlayer) * 320,
            radius: 4,
            damage: 25,
            isPlayer: false,
            color: '#ec4899', // Pink plasma
            life: 3.5,
            maxLife: 3.5,
          });
        }
      } else if (e.type === 'charger') {
        // Visible telegraph windup (0.6s) then hyper-charge dash
        if (e.isCharging) {
          // In active charge
          if (e.chargeDirection) {
            e.vx = e.chargeDirection.x * e.speed * 2.8;
            e.vy = e.chargeDirection.y * e.speed * 2.8;
          }
          e.attackCooldown -= dt;
          if (e.attackCooldown <= 0) {
            e.isCharging = false;
            e.attackCooldown = 2.5;
            e.telegraphTimer = 0;
          }
        } else if (e.telegraphTimer > 0) {
          // In windup telegraph
          e.telegraphTimer -= dt;
          e.vx *= 0.85;
          e.vy *= 0.85;
          e.angle = angleToPlayer;

          if (e.telegraphTimer <= 0) {
            // Trigger charge!
            e.isCharging = true;
            e.chargeDirection = {
              x: Math.cos(angleToPlayer),
              y: Math.sin(angleToPlayer),
            };
            e.attackCooldown = 0.55; // charge duration
            sound.playDash();
          }
        } else {
          // Normal seek until within charge range
          e.angle = angleToPlayer;
          e.vx = Math.cos(angleToPlayer) * e.speed;
          e.vy = Math.sin(angleToPlayer) * e.speed;
          e.attackCooldown -= dt;

          if (e.attackCooldown <= 0 && distToPlayer < 380) {
            e.telegraphTimer = e.maxTelegraph; // 0.6s visible beam telegraph
          }
        }
      } else if (e.type === 'boss') {
        // Sector Dreadnought: Massive armored flagship
        e.angle = Math.PI / 2; // Facing down
        // Hover and sway horizontally at top third
        const targetY = height * 0.22;
        e.vy = (targetY - e.y) * 1.5;
        e.vx = Math.sin(this.gameTime * 0.8) * e.speed;

        e.attackCooldown -= dt;
        if (e.attackCooldown <= 0) {
          e.attackCooldown = 1.4;
          sound.playPlasma();
          // Triple barrage
          for (let b = -1; b <= 1; b++) {
            const bAngle = angleToPlayer + b * 0.2;
            this.projectiles.push({
              id: this.nextEntityId++,
              x: e.x + b * 35,
              y: e.y + 45,
              vx: Math.cos(bAngle) * 360,
              vy: Math.sin(bAngle) * 360,
              radius: 6,
              damage: 30,
              isPlayer: false,
              color: '#ef4444',
              life: 3.5,
              maxLife: 3.5,
            });
          }
        }
      }

      e.x += e.vx * dt;
      e.y += e.vy * dt;

      // Keep within broad playfield
      if (e.type !== 'boss') {
        e.x = clamp(e.x, -20, width + 20);
        e.y = clamp(e.y, -40, height + 40);
      }
    }
  }

  private trySpawnEnemy(wave: WaveConfig, width: number) {
    const spawned = this.enemiesSpawnedThisWave;

    if (wave.hasBoss && !spawned.boss) {
      spawned.boss = true;
      sound.playBossAlert();
      this.enemies.push({
        id: this.nextEntityId++,
        type: 'boss',
        x: width / 2,
        y: -120,
        vx: 0,
        vy: 120,
        angle: Math.PI / 2,
        radius: 65,
        hp: 750,
        maxHp: 750,
        speed: 130,
        hitFlashTimer: 0,
        telegraphTimer: 0,
        maxTelegraph: 1.0,
        attackCooldown: 2.0,
        scoreValue: 5000,
        color: '#ef4444',
      });
      return;
    }

    if (spawned.chargers < wave.chargers && Math.random() < 0.4) {
      spawned.chargers++;
      this.enemies.push({
        id: this.nextEntityId++,
        type: 'charger',
        x: Math.random() * width,
        y: -30,
        vx: 0,
        vy: 80,
        angle: Math.PI / 2,
        radius: 18,
        hp: Math.round(55 * wave.hpMultiplier),
        maxHp: Math.round(55 * wave.hpMultiplier),
        speed: 150 * wave.speedMultiplier,
        hitFlashTimer: 0,
        telegraphTimer: 0,
        maxTelegraph: 0.65,
        attackCooldown: 1.5,
        scoreValue: 280,
        color: '#f97316', // Orange
      });
      return;
    }

    if (spawned.kiters < wave.kiters && Math.random() < 0.5) {
      spawned.kiters++;
      this.enemies.push({
        id: this.nextEntityId++,
        type: 'kiter',
        x: Math.random() < 0.5 ? -20 : width + 20,
        y: Math.random() * (height() * 0.4),
        vx: 0,
        vy: 0,
        angle: 0,
        radius: 15,
        hp: Math.round(40 * wave.hpMultiplier),
        maxHp: Math.round(40 * wave.hpMultiplier),
        speed: 180 * wave.speedMultiplier,
        hitFlashTimer: 0,
        telegraphTimer: 0,
        maxTelegraph: 0,
        attackCooldown: 1.8,
        scoreValue: 220,
        color: '#a855f7', // Violet
      });
      return;
    }

    if (spawned.swarmers < wave.swarmers) {
      spawned.swarmers++;
      this.enemies.push({
        id: this.nextEntityId++,
        type: 'swarmer',
        x: Math.random() * width,
        y: -25,
        vx: 0,
        vy: 120,
        angle: Math.PI / 2,
        radius: 12,
        hp: Math.round(25 * wave.hpMultiplier),
        maxHp: Math.round(25 * wave.hpMultiplier),
        speed: 210 * wave.speedMultiplier,
        hitFlashTimer: 0,
        telegraphTimer: 0,
        maxTelegraph: 0,
        attackCooldown: 0,
        scoreValue: 120,
        color: '#38bdf8', // Cyan
      });
    }

    function height() {
      return 800;
    }
  }

  private updatePowerups(dt: number, height: number) {
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const pow = this.powerups[i];
      pow.y += pow.vy * dt;
      pow.life -= dt;
      pow.pulse += dt * 4;

      // Magnet pull towards player if within 140px
      const d = distance(pow.x, pow.y, this.player.x, this.player.y);
      if (d < 140) {
        const ang = angleBetween(pow.x, pow.y, this.player.x, this.player.y);
        pow.x += Math.cos(ang) * 280 * dt;
        pow.y += Math.sin(ang) * 280 * dt;
      }

      // Collect powerup
      if (d < pow.radius + 18) {
        this.collectPowerup(pow);
        this.powerups.splice(i, 1);
        continue;
      }

      if (pow.life <= 0 || pow.y > height + 40) {
        this.powerups.splice(i, 1);
      }
    }
  }

  private collectPowerup(pow: Powerup) {
    sound.playPowerup();
    this.spawnBurst(pow.x, pow.y, 16, '#22c55e', 180);

    if (pow.type === 'shield') {
      this.player.shields = Math.min(this.player.maxShields, this.player.shields + 40);
      if (this.player.hull < this.player.maxHull) {
        this.player.hull++;
      }
    } else if (pow.type === 'overcharge') {
      this.overchargeTimer = 7.0; // 7s unlimited fire
    } else if (pow.type === 'speed') {
      this.player.energy = this.player.maxEnergy;
      this.player.dashCooldownTimer = 0;
    } else if (pow.type === 'emp') {
      // Detonate full-screen flash and wipe small enemies
      this.triggerHitstop(0.08);
      this.addTrauma(0.5);
      sound.playExplosion(true);
      for (const e of this.enemies) {
        e.hp -= 80;
        e.hitFlashTimer = 0.12;
      }
    }
  }

  private checkCollisions() {
    const p = this.player;

    // 1. Projectiles vs Enemies
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      if (!proj.isPlayer) continue;

      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (checkCircleCollision(proj.x, proj.y, proj.radius, e.x, e.y, e.radius)) {
          // Hit!
          this.stats.shotsHit++;
          e.hp -= proj.damage;
          e.hitFlashTimer = 0.06;

          // Pushback impulse
          const projSpeed = Math.hypot(proj.vx, proj.vy) || 1;
          e.vx += (proj.vx / projSpeed) * 40;
          e.vy += (proj.vy / projSpeed) * 40;

          // Hit sound & juice
          sound.playHit();
          this.spawnBurst(proj.x, proj.y, 6, proj.color, 120);

          // Update combo
          this.currentCombo = updateCombo(this.currentCombo, this.lastHitTime, this.gameTime);
          this.lastHitTime = this.gameTime;
          if (this.currentCombo > this.stats.maxCombo) {
            this.stats.maxCombo = this.currentCombo;
          }
          const { multiplier } = calculateScoreEarned(10, this.currentCombo);
          this.callbacks.onComboUpdate(this.currentCombo, multiplier);

          // Remove projectile (unless EMP shockwave piercing)
          if (proj.weaponType !== 'emp') {
            this.projectiles.splice(i, 1);
          }

          // Enemy Defeated?
          if (e.hp <= 0) {
            this.killEnemy(e, j);
          }
          break;
        }
      }
    }

    // 2. Enemy Projectiles vs Player
    if (p.invincibleTimer <= 0) {
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const proj = this.projectiles[i];
        if (proj.isPlayer) continue;

        if (checkCircleCollision(proj.x, proj.y, proj.radius, p.x, p.y, 16)) {
          this.damagePlayer(proj.damage);
          this.projectiles.splice(i, 1);
          break;
        }
      }
    }

    // 3. Enemy Body vs Player (Ramming)
    if (p.invincibleTimer <= 0) {
      for (const e of this.enemies) {
        if (checkCircleCollision(e.x, e.y, e.radius, p.x, p.y, 16)) {
          const ramDamage = e.type === 'charger' ? 45 : e.type === 'boss' ? 60 : 25;
          this.damagePlayer(ramDamage);
          e.hp -= 30;
          if (e.hp <= 0) {
            const idx = this.enemies.indexOf(e);
            if (idx !== -1) this.killEnemy(e, idx);
          }
          break;
        }
      }
    }
  }

  private damagePlayer(damage: number) {
    const p = this.player;
    const result = applyDamageToDefenses(p.hull, p.shields, damage);
    p.hull = result.remainingHull;
    p.shields = result.remainingShields;
    p.lastDamageTime = this.gameTime;
    p.invincibleTimer = 0.6; // Brief mercy invulnerability

    this.stats.damageTaken += damage;
    this.addTrauma(0.35);
    this.triggerHitstop(0.06);
    sound.playExplosion(false);

    // Break combo on damage
    this.currentCombo = 0;
    this.callbacks.onComboUpdate(0, 1.0);

    // Burst
    this.spawnBurst(p.x, p.y, 14, '#ef4444', 200);

    // Fatal defeat check
    if (result.isFatal) {
      this.handleGameOver(false);
    }
  }

  private killEnemy(e: Enemy, index: number) {
    this.enemies.splice(index, 1);
    this.stats.kills++;

    const { score, multiplier } = calculateScoreEarned(e.scoreValue, this.currentCombo);
    this.stats.score += score;
    if (this.stats.score > this.stats.highScore) {
      this.stats.highScore = this.stats.score;
      if (typeof window !== 'undefined') {
        localStorage.setItem('astrocade_highscore', this.stats.highScore.toString());
      }
    }

    const isLarge = e.type === 'boss' || e.type === 'charger';
    sound.playExplosion(isLarge);
    this.triggerHitstop(isLarge ? 0.08 : 0.04);
    this.addTrauma(isLarge ? 0.4 : 0.15);
    this.spawnBurst(e.x, e.y, isLarge ? 32 : 16, e.color, isLarge ? 260 : 180);

    // Drop Powerup Chance
    const dropRate = e.type === 'boss' ? 1.0 : e.type === 'charger' ? 0.45 : 0.18;
    if (Math.random() < dropRate) {
      const types: Array<'shield' | 'overcharge' | 'speed' | 'emp'> = [
        'shield',
        'overcharge',
        'speed',
        'emp',
      ];
      const randomType = types[Math.floor(Math.random() * types.length)];
      this.powerups.push({
        id: this.nextEntityId++,
        type: randomType,
        x: e.x,
        y: e.y,
        vx: 0,
        vy: 45,
        radius: 12,
        life: 14,
        pulse: 0,
      });
    }

    this.callbacks.onStatsUpdate({ ...this.stats });
    this.callbacks.onComboUpdate(this.currentCombo, multiplier);
  }

  private checkWaveProgress() {
    const wave = getWaveConfig(this.currentWaveNumber);
    const spawned = this.enemiesSpawnedThisWave;

    const allSpawned =
      spawned.swarmers >= wave.swarmers &&
      spawned.kiters >= wave.kiters &&
      spawned.chargers >= wave.chargers &&
      (!wave.hasBoss || spawned.boss);

    if (allSpawned && this.enemies.length === 0) {
      if (this.currentWaveNumber >= 5) {
        // Victory! Sector cleared!
        this.handleGameOver(true);
      } else {
        // Next Wave!
        this.currentWaveNumber++;
        this.stats.wave = this.currentWaveNumber;
        this.enemiesSpawnedThisWave = { swarmers: 0, kiters: 0, chargers: 0, boss: false };
        this.waveSpawnTimer = 1.2;
        sound.playVictory();
        this.callbacks.onStatsUpdate({ ...this.stats });
      }
    }
  }

  private handleGameOver(isVictory: boolean) {
    this.phase = 'gameover';
    this.outcome = isVictory ? 'victory' : 'defeat';
    document.body.dataset.state = 'gameover';

    if (isVictory) {
      sound.playVictory();
    } else {
      sound.playDefeat();
    }

    this.callbacks.onPhaseChange(this.phase, this.outcome);
    this.callbacks.onStatsUpdate({ ...this.stats });
  }

  private render() {
    const ctx = this.ctx;
    const viewWidth = this.canvas.getBoundingClientRect().width || 1280;
    const viewHeight = this.canvas.getBoundingClientRect().height || 800;

    ctx.save();

    // Clear background
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, viewWidth, viewHeight);

    // Apply Camera Shake offset
    if (this.cameraTrauma > 0) {
      const shakeMagnitude = this.cameraTrauma * this.cameraTrauma * 14;
      const shakeX = (Math.random() * 2 - 1) * shakeMagnitude;
      const shakeY = (Math.random() * 2 - 1) * shakeMagnitude;
      ctx.translate(shakeX, shakeY);
    }

    // 1. Render Stars
    for (const s of this.stars) {
      ctx.fillStyle = `rgba(224, 231, 255, ${s.brightness})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Render Powerups
    for (const pow of this.powerups) {
      const pulseSize = pow.radius + Math.sin(pow.pulse) * 3;
      ctx.save();
      ctx.translate(pow.x, pow.y);

      // Outer glow
      const color =
        pow.type === 'shield'
          ? '#22c55e'
          : pow.type === 'overcharge'
          ? '#eab308'
          : pow.type === 'speed'
          ? '#38bdf8'
          : '#a855f7';

      ctx.fillStyle = `${color}33`;
      ctx.beginPath();
      ctx.arc(0, 0, pulseSize * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Main core
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, pulseSize, 0, Math.PI * 2);
      ctx.fill();

      // Inner icon label
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label =
        pow.type === 'shield'
          ? 'HP'
          : pow.type === 'overcharge'
          ? 'PWR'
          : pow.type === 'speed'
          ? 'SPD'
          : 'EMP';
      ctx.fillText(label, 0, 0);

      ctx.restore();
    }

    // 3. Render Particles
    for (const p of this.particles) {
      if (!p.active) continue;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 4. Render Projectiles
    for (const proj of this.projectiles) {
      ctx.save();
      ctx.fillStyle = proj.color;
      ctx.shadowColor = proj.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 5. Render Enemies
    for (const e of this.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.angle);

      // Visible windup telegraph line for chargers
      if (e.type === 'charger' && e.telegraphTimer > 0) {
        ctx.save();
        ctx.rotate(-e.angle);
        const progress = 1 - e.telegraphTimer / e.maxTelegraph;
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.4 + progress * 0.6})`;
        ctx.lineWidth = 2 + progress * 4;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(
          Math.cos(e.angle) * 450,
          Math.sin(e.angle) * 450
        );
        ctx.stroke();
        ctx.restore();
      }

      // Hit flash override (white)
      if (e.hitFlashTimer > 0) {
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 15;
      } else {
        ctx.fillStyle = e.color;
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 10;
      }

      // Draw custom archetype silhouettes:
      if (e.type === 'swarmer') {
        // Agile arrow fighter
        ctx.beginPath();
        ctx.moveTo(e.radius * 1.3, 0);
        ctx.lineTo(-e.radius * 0.9, -e.radius * 0.9);
        ctx.lineTo(-e.radius * 0.4, 0);
        ctx.lineTo(-e.radius * 0.9, e.radius * 0.9);
        ctx.closePath();
        ctx.fill();
      } else if (e.type === 'kiter') {
        // Hexagonal Cruiser with energy orb
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          const px = Math.cos(a) * e.radius;
          const py = Math.sin(a) * e.radius;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        // Inner core
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.arc(0, 0, e.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === 'charger') {
        // Heavy Ramming Gunship with front blades
        ctx.beginPath();
        ctx.moveTo(e.radius * 1.5, 0);
        ctx.lineTo(e.radius * 0.4, -e.radius);
        ctx.lineTo(-e.radius, -e.radius * 0.8);
        ctx.lineTo(-e.radius * 0.5, 0);
        ctx.lineTo(-e.radius, e.radius * 0.8);
        ctx.lineTo(e.radius * 0.4, e.radius);
        ctx.closePath();
        ctx.fill();
      } else if (e.type === 'boss') {
        // Sector Dreadnought
        ctx.beginPath();
        ctx.moveTo(0, e.radius);
        ctx.lineTo(e.radius * 1.2, -e.radius * 0.3);
        ctx.lineTo(e.radius * 0.8, -e.radius * 0.9);
        ctx.lineTo(-e.radius * 0.8, -e.radius * 0.9);
        ctx.lineTo(-e.radius * 1.2, -e.radius * 0.3);
        ctx.closePath();
        ctx.fill();

        // Dreadnought core reactor
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(0, 0, e.radius * 0.35, 0, Math.PI * 2);
        ctx.fill();

        // Pulsing shield ring
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, e.radius * 1.15, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }

    // 6. Render Player Ship
    const p = this.player;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(p.squashX, p.squashY);
    ctx.rotate(p.angle);

    // Invulnerability blink
    if (p.invincibleTimer <= 0 || Math.floor(this.gameTime * 20) % 2 === 0) {
      // Shield aura if active
      if (p.shields > 10) {
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.25 + (p.shields / p.maxShields) * 0.45})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 24, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Ship hull (Apex Starfighter)
      ctx.fillStyle = '#0284c7';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.moveTo(18, 0); // Nose tip
      ctx.lineTo(-14, -13); // Left wing
      ctx.lineTo(-8, -4); // Left fuselage
      ctx.lineTo(-12, 0); // Engine exhaust
      ctx.lineTo(-8, 4); // Right fuselage
      ctx.lineTo(-14, 13); // Right wing
      ctx.closePath();
      ctx.fill();

      // Cockpit glass canopy
      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(-2, -3);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-2, 3);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();

    ctx.restore();
  }
}
