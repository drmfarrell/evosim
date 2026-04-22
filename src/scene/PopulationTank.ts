// Population tank: N creatures swimming in a 3D box. The tank is the
// ChemSim-style volumetric container; fish inside exhibit decorative
// behavior (seeking food, occasional courtship) that does NOT feed
// back into fitness. Fitness is configured per the active regime in
// Rust; these behaviors are purely visual so students can connect
// phenotype to observable behavior.

import * as THREE from "three";
import { SceneManager } from "./SceneManager";
import { SimState, CreatureJson } from "../state/SimState";
import { computePhenotype } from "../utils/phenotype";
import {
  FishAgent,
  FoodParticle,
  DEFAULT_BEHAVIOR,
  spawnFoodField,
  stepBehavior,
  buildFoodMesh,
} from "./TankBehavior";

const FISH_SCALE = 0.22;

export class PopulationTank {
  private boxHelper: THREE.LineSegments | null = null;
  private gradientHelper: THREE.Mesh | null = null;
  private instancedBody: THREE.InstancedMesh | null = null;
  private instancedTail: THREE.InstancedMesh | null = null;
  private foodMesh: THREE.InstancedMesh | null = null;
  private population: CreatureJson[] = [];
  private agents: FishAgent[] = [];
  private food: FoodParticle[] = [];
  private archetype: any;
  private unsubs: Array<() => void> = [];
  private animUnsub: (() => void) | null = null;
  private visible = false;
  private behaviorSpeedMultiplier = 1;

  constructor(private scene: SceneManager, private state: SimState, archetype: any) {
    this.archetype = archetype;
    this.buildTankEnvironment();
    this.food = spawnFoodField(DEFAULT_BEHAVIOR);
    this.unsubs.push(state.onView.subscribe((v) => this.setVisible(v === "tank")));
    this.setVisible(state.view === "tank");
  }

  /** Multiplier applied to intra-generation behavior tick rate.
   *  Higher = fish appear to move faster. 1.0 = natural. */
  setBehaviorSpeed(multiplier: number): void {
    this.behaviorSpeedMultiplier = Math.max(0, multiplier);
  }

  private buildTankEnvironment(): void {
    const { tankSize } = DEFAULT_BEHAVIOR;
    const box = new THREE.BoxGeometry(tankSize.x, tankSize.y, tankSize.z);
    const wireframe = new THREE.WireframeGeometry(box);
    const lines = new THREE.LineSegments(
      wireframe,
      new THREE.LineBasicMaterial({ color: 0x263040, transparent: true, opacity: 0.5 })
    );
    lines.visible = false;
    this.boxHelper = lines;
    this.scene.scene.add(lines);

    const planeGeom = new THREE.PlaneGeometry(tankSize.x, tankSize.y, 1, 32);
    const planeMat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {},
      vertexShader: `
        varying float vY;
        void main() {
          vY = position.y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying float vY;
        void main() {
          float t = clamp((vY + ${(tankSize.y / 2).toFixed(1)}) / ${tankSize.y.toFixed(1)}, 0.0, 1.0);
          vec3 warm = vec3(0.25, 0.35, 0.5);
          vec3 cold = vec3(0.05, 0.08, 0.14);
          vec3 c = mix(cold, warm, t);
          gl_FragColor = vec4(c, 0.25);
        }
      `,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const plane = new THREE.Mesh(planeGeom, planeMat);
    plane.position.z = -tankSize.z / 2 - 0.01;
    plane.visible = false;
    this.gradientHelper = plane;
    this.scene.scene.add(plane);

    // Food mesh (instanced; one slot per food particle).
    const foodMesh = buildFoodMesh(DEFAULT_BEHAVIOR.foodCount);
    foodMesh.visible = false;
    this.foodMesh = foodMesh;
    this.scene.scene.add(foodMesh);
  }

  setPopulation(creatures: CreatureJson[]): void {
    this.population = creatures;
    const currentCapacity = this.instancedBody?.count ?? 0;
    if (creatures.length !== currentCapacity) {
      this.rebuildInstances();
      this.rebuildAgents();
    } else {
      this.refreshInstanceAttrs();
      this.refreshAgents();
    }
  }

  private rebuildInstances(): void {
    if (this.instancedBody) {
      this.scene.scene.remove(this.instancedBody);
      this.instancedBody.geometry.dispose();
      (this.instancedBody.material as THREE.Material).dispose();
      this.instancedBody = null;
    }
    if (this.instancedTail) {
      this.scene.scene.remove(this.instancedTail);
      this.instancedTail.geometry.dispose();
      (this.instancedTail.material as THREE.Material).dispose();
      this.instancedTail = null;
    }
    const n = this.population.length;
    if (n === 0) return;

    const bodyGeom = new THREE.SphereGeometry(1, 10, 8);
    bodyGeom.scale(1.4, 0.5, 0.35);
    const bodyMat = new THREE.MeshStandardMaterial({
      roughness: 0.8,
      metalness: 0.05,
    });
    const body = new THREE.InstancedMesh(bodyGeom, bodyMat, n);
    body.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    body.visible = this.visible;

    const tailGeom = new THREE.ConeGeometry(0.4, 0.8, 6);
    tailGeom.rotateZ(Math.PI / 2);
    const tailMat = new THREE.MeshStandardMaterial({ color: 0x3a4050, roughness: 0.8 });
    const tail = new THREE.InstancedMesh(tailGeom, tailMat, n);
    tail.visible = this.visible;

    this.scene.scene.add(body);
    this.scene.scene.add(tail);
    this.instancedBody = body;
    this.instancedTail = tail;

    if (!this.animUnsub) {
      this.animUnsub = this.scene.registerAnim((dt) => this.tick(dt));
    }
  }

  private rebuildAgents(): void {
    const { tankSize } = DEFAULT_BEHAVIOR;
    this.agents = this.population.map((c) => {
      const ph = computePhenotype(c, this.archetype);
      const margin = FISH_SCALE * 2;
      return {
        x: (Math.random() - 0.5) * (tankSize.x - 2 * margin),
        y: (Math.random() - 0.5) * (tankSize.y - 2 * margin),
        z: (Math.random() - 0.5) * (tankSize.z - 2 * margin),
        yaw: Math.random() * Math.PI * 2,
        speed: 0.5 + 1.5 * (ph.metabolic_rate ?? 0.5),
        displayIntensity: ph.mating_display_intensity ?? 0.3,
        isMale: c.sex === "male",
        targetFoodIdx: null,
        courtshipPartnerIdx: null,
        courtshipT: 0,
        eatPulse: 0,
        phase: Math.random() * Math.PI * 2,
      } as FishAgent;
    });
    this.applyBodyColors();
  }

  /** New generation, same capacity: keep positions but update
   *  phenotype-derived parameters and colors. */
  private refreshAgents(): void {
    for (let i = 0; i < this.population.length; i++) {
      const c = this.population[i];
      const ph = computePhenotype(c, this.archetype);
      const a = this.agents[i];
      if (!a) continue;
      a.speed = 0.5 + 1.5 * (ph.metabolic_rate ?? 0.5);
      a.displayIntensity = ph.mating_display_intensity ?? 0.3;
      a.isMale = c.sex === "male";
    }
    this.applyBodyColors();
  }

  private refreshInstanceAttrs(): void {
    this.applyBodyColors();
  }

  private applyBodyColors(): void {
    if (!this.instancedBody) return;
    for (let i = 0; i < this.population.length; i++) {
      const ph = computePhenotype(this.population[i], this.archetype);
      const hue = clamp(ph.body_color_hue ?? 0.5, 0, 1);
      this.instancedBody.setColorAt(i, bodyColor(hue));
    }
    this.instancedBody.instanceColor!.needsUpdate = true;
  }

  private tick(dt: number): void {
    if (!this.visible) return;
    if (!this.instancedBody || !this.instancedTail) return;
    if (this.agents.length === 0) return;

    const scaledDt = Math.min(0.1, dt * this.behaviorSpeedMultiplier);
    stepBehavior(this.agents, this.food, DEFAULT_BEHAVIOR, scaledDt);

    const tmp = new THREE.Object3D();
    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i];
      const c = this.population[i];
      const ph = c ? computePhenotype(c, this.archetype) : {};
      const sizeScale = FISH_SCALE * clamp(ph.body_size ?? 1.0, 0.6, 1.6);
      const pulse = 1 + a.eatPulse * 0.25;
      tmp.position.set(a.x, a.y, a.z);
      tmp.rotation.set(0, a.yaw, 0);
      tmp.scale.setScalar(sizeScale * pulse);
      tmp.updateMatrix();
      this.instancedBody.setMatrixAt(i, tmp.matrix);

      tmp.position.set(
        a.x - Math.sin(a.yaw) * sizeScale * 1.7,
        a.y,
        a.z - Math.cos(a.yaw) * sizeScale * 1.7
      );
      tmp.scale.setScalar(sizeScale * 0.7);
      tmp.updateMatrix();
      this.instancedTail.setMatrixAt(i, tmp.matrix);
    }
    this.instancedBody.instanceMatrix.needsUpdate = true;
    this.instancedTail.instanceMatrix.needsUpdate = true;

    if (this.foodMesh) {
      const fTmp = new THREE.Object3D();
      for (let fi = 0; fi < this.food.length; fi++) {
        const f = this.food[fi];
        const active = f.respawnIn <= 0;
        const vis = active ? 1.0 : 0.0;
        fTmp.position.set(f.x, f.y, f.z);
        fTmp.scale.setScalar(vis);
        fTmp.updateMatrix();
        this.foodMesh.setMatrixAt(fi, fTmp.matrix);
      }
      this.foodMesh.instanceMatrix.needsUpdate = true;
    }
  }

  private setVisible(v: boolean): void {
    this.visible = v;
    if (this.boxHelper) this.boxHelper.visible = v;
    if (this.gradientHelper) this.gradientHelper.visible = v;
    if (this.instancedBody) this.instancedBody.visible = v;
    if (this.instancedTail) this.instancedTail.visible = v;
    if (this.foodMesh) this.foodMesh.visible = v;
    if (v) {
      const { tankSize } = DEFAULT_BEHAVIOR;
      this.scene.camera.position.set(0, tankSize.y * 0.25, tankSize.x * 1.3);
      this.scene.camera.lookAt(0, 0, 0);
    } else {
      this.scene.camera.position.set(0, 1.2, 4.5);
      this.scene.camera.lookAt(0, 0, 0);
    }
  }

  dispose(): void {
    for (const u of this.unsubs) u();
    if (this.animUnsub) this.animUnsub();
    if (this.boxHelper) this.scene.scene.remove(this.boxHelper);
    if (this.gradientHelper) this.scene.scene.remove(this.gradientHelper);
    if (this.instancedBody) this.scene.scene.remove(this.instancedBody);
    if (this.instancedTail) this.scene.scene.remove(this.instancedTail);
    if (this.foodMesh) this.scene.scene.remove(this.foodMesh);
  }
}

function bodyColor(hue: number): THREE.Color {
  const dark = new THREE.Color(0x1b2230);
  const light = new THREE.Color(0xbdc2b2);
  return dark.clone().lerp(light, hue);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
