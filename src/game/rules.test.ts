import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clamp,
  distance,
  checkCircleCollision,
  calculateScoreEarned,
  updateCombo,
  canFireWeapon,
  applyDamageToDefenses,
  regenerateShields,
  regenerateEnergy,
  getWaveConfig,
  calculateAccuracy,
  generateAstrocadeManifest,
  WEAPON_CONFIGS,
} from './rules';

test('clamp restricts numbers within bounds', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-3, 0, 10), 0);
  assert.equal(clamp(15, 0, 10), 10);
});

test('distance calculates Euclidean 2D distance correctly', () => {
  assert.equal(distance(0, 0, 3, 4), 5);
  assert.equal(distance(10, 10, 10, 10), 0);
});

test('checkCircleCollision accurately detects overlapping and separating circles', () => {
  // Colliding
  assert.equal(checkCircleCollision(0, 0, 10, 15, 0, 10), true);
  // Touching
  assert.equal(checkCircleCollision(0, 0, 10, 20, 0, 10), true);
  // Separated
  assert.equal(checkCircleCollision(0, 0, 10, 25, 0, 10), false);
});

test('calculateScoreEarned applies tiered combo multiplier', () => {
  // Base score 100 with 0 combo -> 1.0x -> 100
  const r0 = calculateScoreEarned(100, 0);
  assert.equal(r0.score, 100);
  assert.equal(r0.multiplier, 1.0);

  // Combo 4 -> 1.5x -> 150
  const r4 = calculateScoreEarned(100, 4);
  assert.equal(r4.score, 150);
  assert.equal(r4.multiplier, 1.5);

  // Combo 8 -> 2.0x -> 200
  const r8 = calculateScoreEarned(100, 8);
  assert.equal(r8.score, 200);
  assert.equal(r8.multiplier, 2.0);

  // High combo capped at 4.0x
  const rHigh = calculateScoreEarned(100, 40);
  assert.equal(rHigh.score, 400);
  assert.equal(rHigh.multiplier, 4.0);
});

test('updateCombo resets when combo window expires', () => {
  // Within window
  assert.equal(updateCombo(5, 10.0, 11.0, 2.5), 6);
  // Expired window
  assert.equal(updateCombo(5, 10.0, 13.0, 2.5), 1);
});

test('canFireWeapon enforces energy and cooldown thresholds', () => {
  // Sufficient energy and zero cooldown
  const ok = canFireWeapon('vulcan', 50, 0, 1.0);
  assert.equal(ok.canFire, true);

  // Insufficient energy
  const noEnergy = canFireWeapon('emp', 20, 0, 5.0);
  assert.equal(noEnergy.canFire, false);
  assert.equal(noEnergy.requiredEnergy, WEAPON_CONFIGS.emp.energyCost);

  // On cooldown
  const onCooldown = canFireWeapon('vulcan', 50, 1.0, 1.05); // cooldown is 0.12
  assert.equal(onCooldown.canFire, false);
  assert.ok(onCooldown.cooldownRemaining > 0);
});

test('applyDamageToDefenses drains shields first then spills into hull', () => {
  // Damage less than shields
  const hit1 = applyDamageToDefenses(100, 50, 30);
  assert.equal(hit1.remainingShields, 20);
  assert.equal(hit1.remainingHull, 100);
  assert.equal(hit1.shieldDamageTaken, 30);
  assert.equal(hit1.hullDamageTaken, 0);
  assert.equal(hit1.isFatal, false);

  // Damage breaking shields with spillover
  const hit2 = applyDamageToDefenses(100, 30, 50);
  assert.equal(hit2.remainingShields, 0);
  assert.equal(hit2.remainingHull, 80);
  assert.equal(hit2.shieldDamageTaken, 30);
  assert.equal(hit2.hullDamageTaken, 20);
  assert.equal(hit2.isFatal, false);

  // Fatal blow
  const fatalHit = applyDamageToDefenses(20, 0, 50);
  assert.equal(fatalHit.remainingHull, 0);
  assert.equal(fatalHit.isFatal, true);
});

test('regenerateShields respects delay and bounds', () => {
  // Within delay period (< 3.0s) -> no regen
  const delayed = regenerateShields(50, 100, 10.0, 12.0, 0.5);
  assert.equal(delayed, 50);

  // After delay -> regens at 20/sec
  const regened = regenerateShields(50, 100, 10.0, 14.0, 0.5, 20, 3.0);
  assert.equal(regened, 60);

  // Capped at max
  const capped = regenerateShields(95, 100, 10.0, 15.0, 1.0, 20, 3.0);
  assert.equal(capped, 100);
});

test('regenerateEnergy smoothly replenishes energy up to maximum', () => {
  const energy = regenerateEnergy(40, 100, 0.5, 30);
  assert.equal(energy, 55);
  const capped = regenerateEnergy(95, 100, 0.5, 30);
  assert.equal(capped, 100);
});

test('getWaveConfig generates ramping encounter designs', () => {
  const w1 = getWaveConfig(1);
  assert.equal(w1.wave, 1);
  assert.equal(w1.hasBoss, false);
  assert.ok(w1.swarmers > 0);

  const w3 = getWaveConfig(3);
  assert.ok(w3.chargers > 0);
  assert.ok(w3.speedMultiplier > w1.speedMultiplier);

  const w5 = getWaveConfig(5);
  assert.equal(w5.hasBoss, true);
});

test('calculateAccuracy returns valid percentages', () => {
  assert.equal(calculateAccuracy(0, 0), 0);
  assert.equal(calculateAccuracy(100, 75), 75);
  assert.equal(calculateAccuracy(50, 50), 100);
});

test('generateAstrocadeManifest creates valid MCP payload', () => {
  const stats = {
    score: 12500,
    highScore: 25000,
    wave: 3,
    maxWave: 5,
    kills: 34,
    shotsFired: 120,
    shotsHit: 84,
    maxCombo: 18,
    timeElapsed: 95.4,
    damageTaken: 60,
  };
  const manifest = generateAstrocadeManifest(stats);
  assert.equal(manifest.astrocade_protocol, 'mcp-game-manifest/v1');
  assert.equal(manifest.server_endpoint, 'https://mcp.astrocade.com/mcp');
  assert.equal(manifest.run_telemetry.score, 12500);
  assert.equal(manifest.run_telemetry.accuracy_pct, 70);
});
