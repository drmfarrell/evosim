// Decorative intra-generation behavior for the population tank.
//
// This module makes fish look alive: they swim toward nearby food
// particles, pulse when they "eat," and occasionally drift to a
// nearby opposite-sex neighbor for a brief courtship circle. NONE of
// this feeds back into fitness; the engine still drives genetics
// deterministically. The behavior exists so students can see
// phenotype-driven differences (fast metabolism swims faster, strong
// display wiggles more) as they watch the tank.
//
// See CLAUDE.md "Anti-patterns" — decorative behavior is explicitly
// permitted, emergent fitness is explicitly not.

import * as THREE from "three";

export type BehaviorParams = {
  tankSize: { x: number; y: number; z: number };
  foodCount: number;
  perceptionRadius: number;
  eatDistance: number;
  baseSpeed: number;
  courtshipChance: number;
};

export const DEFAULT_BEHAVIOR: BehaviorParams = {
  tankSize: { x: 14, y: 6, z: 6 },
  foodCount: 18,
  perceptionRadius: 2.2,
  eatDistance: 0.3,
  baseSpeed: 0.35,
  courtshipChance: 0.0015,
};

export type FishAgent = {
  // Current position + heading.
  x: number;
  y: number;
  z: number;
  yaw: number;
  // Phenotype-derived.
  speed: number; // units per second, before any multiplier
  displayIntensity: number;
  isMale: boolean;
  // Behavior state.
  targetFoodIdx: number | null;
  courtshipPartnerIdx: number | null;
  courtshipT: number; // 0..1 remaining
  eatPulse: number; // brief visual pulse, decays to 0
  phase: number;
};

export type FoodParticle = {
  x: number;
  y: number;
  z: number;
  respawnIn: number; // seconds until a fresh particle spawns (0 when active)
};

/** Build initial food particles scattered in the tank. */
export function spawnFoodField(params: BehaviorParams): FoodParticle[] {
  const out: FoodParticle[] = [];
  for (let i = 0; i < params.foodCount; i++) {
    out.push(spawnFoodAt(params));
  }
  return out;
}

function spawnFoodAt(p: BehaviorParams): FoodParticle {
  return {
    x: (Math.random() - 0.5) * (p.tankSize.x - 1.5),
    y: (Math.random() - 0.5) * (p.tankSize.y - 1.0),
    z: (Math.random() - 0.5) * (p.tankSize.z - 1.0),
    respawnIn: 0,
  };
}

/** Single behavior tick: update each fish's position + state. */
export function stepBehavior(
  agents: FishAgent[],
  food: FoodParticle[],
  params: BehaviorParams,
  dt: number
): void {
  // Respawn consumed food.
  for (const f of food) {
    if (f.respawnIn > 0) {
      f.respawnIn -= dt;
      if (f.respawnIn <= 0) {
        const fresh = spawnFoodAt(params);
        f.x = fresh.x;
        f.y = fresh.y;
        f.z = fresh.z;
        f.respawnIn = 0;
      }
    }
  }

  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];

    // Decay eat pulse.
    if (a.eatPulse > 0) a.eatPulse = Math.max(0, a.eatPulse - dt * 2);

    // Pick a target if we don't have one.
    if (a.courtshipPartnerIdx == null && a.targetFoodIdx == null) {
      // Nearest live food in perception.
      let best = -1;
      let bestD2 = params.perceptionRadius * params.perceptionRadius;
      for (let fi = 0; fi < food.length; fi++) {
        if (food[fi].respawnIn > 0) continue;
        const d2 = distSq(a, food[fi]);
        if (d2 < bestD2) {
          bestD2 = d2;
          best = fi;
        }
      }
      if (best >= 0) a.targetFoodIdx = best;
      else if (Math.random() < params.courtshipChance) {
        // Look for a nearby opposite-sex neighbor for a brief dance.
        let pBest = -1;
        let pBestD2 = (params.perceptionRadius * 1.2) ** 2;
        for (let j = 0; j < agents.length; j++) {
          if (j === i) continue;
          if (agents[j].isMale === a.isMale) continue;
          const dx = agents[j].x - a.x;
          const dy = agents[j].y - a.y;
          const dz = agents[j].z - a.z;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < pBestD2) {
            pBestD2 = d2;
            pBest = j;
          }
        }
        if (pBest >= 0) {
          a.courtshipPartnerIdx = pBest;
          a.courtshipT = 2.5; // seconds
        }
      }
    }

    // Steering.
    let tx = a.x;
    let ty = a.y;
    let tz = a.z;
    let moving = false;

    if (a.targetFoodIdx != null) {
      const f = food[a.targetFoodIdx];
      if (!f || f.respawnIn > 0) {
        a.targetFoodIdx = null;
      } else {
        tx = f.x;
        ty = f.y;
        tz = f.z;
        moving = true;
        // Arrived.
        if (distSq(a, f) < params.eatDistance * params.eatDistance) {
          f.respawnIn = 2 + Math.random() * 3;
          a.targetFoodIdx = null;
          a.eatPulse = 1.0;
        }
      }
    } else if (a.courtshipPartnerIdx != null) {
      const p = agents[a.courtshipPartnerIdx];
      a.courtshipT -= dt;
      if (a.courtshipT <= 0) {
        a.courtshipPartnerIdx = null;
      } else {
        // Circle around the partner at a comfortable distance.
        const dx = p.x - a.x;
        const dy = p.y - a.y;
        const dz = p.z - a.z;
        const dist = Math.hypot(dx, dy, dz) + 1e-6;
        const circle = 1.0;
        tx = p.x - (dx / dist) * circle + Math.sin(a.courtshipT * 3 + a.phase) * a.displayIntensity;
        ty = p.y + Math.sin(a.courtshipT * 4 + a.phase) * 0.3 * a.displayIntensity;
        tz = p.z - (dz / dist) * circle + Math.cos(a.courtshipT * 3 + a.phase) * a.displayIntensity;
        moving = true;
      }
    }

    if (moving) {
      const dx = tx - a.x;
      const dy = ty - a.y;
      const dz = tz - a.z;
      const d = Math.hypot(dx, dy, dz) + 1e-6;
      const step = Math.min(d, a.speed * params.baseSpeed * dt * (1 + 0.5 * (a.eatPulse > 0 ? 0 : 1)));
      a.x += (dx / d) * step;
      a.y += (dy / d) * step;
      a.z += (dz / d) * step;
      a.yaw = Math.atan2(dx, dz);
    } else {
      // Gentle idle drift.
      a.x += Math.sin(a.phase + a.x) * 0.05 * dt;
      a.y += Math.cos(a.phase + a.y * 0.5) * 0.05 * dt;
      a.z += Math.sin(a.phase * 1.3 + a.z) * 0.05 * dt;
      a.yaw += Math.sin(a.phase) * 0.05 * dt;
    }

    // Keep fish within the tank; soft-clamp with a nudge.
    clampInside(a, params.tankSize);
  }
}

function distSq(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

function clampInside(
  a: { x: number; y: number; z: number },
  tank: { x: number; y: number; z: number }
): void {
  const mx = tank.x / 2 - 0.3;
  const my = tank.y / 2 - 0.3;
  const mz = tank.z / 2 - 0.3;
  if (a.x > mx) a.x = mx;
  if (a.x < -mx) a.x = -mx;
  if (a.y > my) a.y = my;
  if (a.y < -my) a.y = -my;
  if (a.z > mz) a.z = mz;
  if (a.z < -mz) a.z = -mz;
}

/** Build the instanced food mesh. Caller manages lifecycle. */
export function buildFoodMesh(count: number): THREE.InstancedMesh {
  const geom = new THREE.SphereGeometry(0.08, 6, 4);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xf0b429,
    emissive: 0x8b4a00,
    emissiveIntensity: 0.5,
    roughness: 0.4,
  });
  const mesh = new THREE.InstancedMesh(geom, mat, count);
  return mesh;
}
