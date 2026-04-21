// Population tank: N creatures swimming in a 3D box. The box reuses
// the ChemSim volumetric aesthetic (box walls, soft fog, caustic-style
// light) without ChemSim's physics. Creatures are simplified (single
// body mesh per instance + optional tail); full detail lives in the
// organism view.
//
// Movement is purely kinematic: each creature carries a per-instance
// orientation + phase that drives a Perlin-style drift. This is
// *decorative only*, never causal. Fitness is configured, not
// emergent.

import * as THREE from "three";
import { SceneManager } from "./SceneManager";
import { SimState, CreatureJson } from "../state/SimState";
import { computePhenotype } from "../utils/phenotype";

const TANK_SIZE = { x: 8, y: 4, z: 4 };

export class PopulationTank {
  private boxHelper: THREE.LineSegments | null = null;
  private gradientHelper: THREE.Mesh | null = null;
  private instancedBody: THREE.InstancedMesh | null = null;
  private instancedTail: THREE.InstancedMesh | null = null;
  private population: CreatureJson[] = [];
  private drifts: Array<{ cx: number; cy: number; cz: number; phase: number; speed: number; yaw: number }> = [];
  private archetype: any;
  private unsubs: Array<() => void> = [];
  private animUnsub: (() => void) | null = null;
  private visible = false;

  constructor(private scene: SceneManager, private state: SimState, archetype: any) {
    this.archetype = archetype;
    this.buildTankEnvironment();
    this.unsubs.push(state.onView.subscribe((v) => this.setVisible(v === "tank")));
    this.setVisible(state.view === "tank");
  }

  private buildTankEnvironment(): void {
    const box = new THREE.BoxGeometry(TANK_SIZE.x, TANK_SIZE.y, TANK_SIZE.z);
    const wireframe = new THREE.WireframeGeometry(box);
    const lines = new THREE.LineSegments(
      wireframe,
      new THREE.LineBasicMaterial({ color: 0x263040, transparent: true, opacity: 0.5 })
    );
    lines.visible = false;
    this.boxHelper = lines;
    this.scene.scene.add(lines);

    // Depth gradient: translucent plane that fades warm→cool top to bottom.
    const planeGeom = new THREE.PlaneGeometry(TANK_SIZE.x, TANK_SIZE.y, 1, 32);
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
          float t = clamp((vY + ${(TANK_SIZE.y / 2).toFixed(1)}) / ${TANK_SIZE.y.toFixed(1)}, 0.0, 1.0);
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
    plane.position.z = -TANK_SIZE.z / 2 - 0.01;
    plane.visible = false;
    this.gradientHelper = plane;
    this.scene.scene.add(plane);
  }

  setPopulation(creatures: CreatureJson[]): void {
    this.population = creatures;
    const currentCapacity = this.instancedBody?.count ?? 0;
    if (creatures.length !== currentCapacity) {
      this.rebuildInstances();
    } else {
      this.refreshInstanceAttrs();
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
      vertexColors: false,
    });
    const body = new THREE.InstancedMesh(bodyGeom, bodyMat, n);
    body.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    body.visible = this.visible;

    const tailGeom = new THREE.ConeGeometry(0.4, 0.8, 6);
    tailGeom.rotateZ(Math.PI / 2);
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0x3a4050,
      roughness: 0.8,
    });
    const tail = new THREE.InstancedMesh(tailGeom, tailMat, n);
    tail.visible = this.visible;

    const tmp = new THREE.Object3D();
    this.drifts = [];

    for (let i = 0; i < n; i++) {
      const c = this.population[i];
      const ph = computePhenotype(c, this.archetype);
      const hue = clamp(ph.body_color_hue ?? 0.5, 0, 1);
      const size = clamp(ph.body_size ?? 1.0, 0.5, 2.0);
      const streamlined = clamp(ph.body_shape_streamlined ?? 0.5, 0, 1);
      const color = bodyColor(hue);
      body.setColorAt(i, color);

      const cx = (Math.random() - 0.5) * (TANK_SIZE.x - 1);
      const cy = (Math.random() - 0.5) * (TANK_SIZE.y - 0.5);
      const cz = (Math.random() - 0.5) * (TANK_SIZE.z - 0.5);
      const yaw = Math.random() * Math.PI * 2;
      this.drifts.push({
        cx,
        cy,
        cz,
        phase: Math.random() * Math.PI * 2,
        speed: 0.15 + 0.15 * (ph.metabolic_rate ?? 0.5),
        yaw,
      });

      const scale = 0.25 + 0.15 * size;
      tmp.position.set(cx, cy, cz);
      tmp.scale.set(scale * (1 + 0.2 * streamlined), scale, scale);
      tmp.rotation.set(0, yaw, 0);
      tmp.updateMatrix();
      body.setMatrixAt(i, tmp.matrix);

      // Tail placed slightly behind body.
      tmp.position.x += -Math.cos(yaw) * scale * 1.5;
      tmp.position.z += -Math.sin(yaw) * scale * 1.5;
      tmp.scale.set(scale * 0.8, scale * 0.8, scale * 0.8);
      tmp.updateMatrix();
      tail.setMatrixAt(i, tmp.matrix);
    }

    body.instanceMatrix.needsUpdate = true;
    body.instanceColor!.needsUpdate = true;
    tail.instanceMatrix.needsUpdate = true;

    this.scene.scene.add(body);
    this.scene.scene.add(tail);
    this.instancedBody = body;
    this.instancedTail = tail;

    if (!this.animUnsub) {
      this.animUnsub = this.scene.registerAnim((dt, t) => this.tick(dt, t));
    }
  }

  /** Update per-instance color + drift state without reallocating the
   *  InstancedMesh. Called when the population size didn't change. */
  private refreshInstanceAttrs(): void {
    if (!this.instancedBody) return;
    const body = this.instancedBody;
    const n = this.population.length;
    this.drifts = [];
    for (let i = 0; i < n; i++) {
      const c = this.population[i];
      const ph = computePhenotype(c, this.archetype);
      const hue = clamp(ph.body_color_hue ?? 0.5, 0, 1);
      body.setColorAt(i, bodyColor(hue));
      const cx = (Math.random() - 0.5) * (TANK_SIZE.x - 1);
      const cy = (Math.random() - 0.5) * (TANK_SIZE.y - 0.5);
      const cz = (Math.random() - 0.5) * (TANK_SIZE.z - 0.5);
      const yaw = Math.random() * Math.PI * 2;
      this.drifts.push({
        cx,
        cy,
        cz,
        phase: Math.random() * Math.PI * 2,
        speed: 0.15 + 0.15 * (ph.metabolic_rate ?? 0.5),
        yaw,
      });
    }
    body.instanceColor!.needsUpdate = true;
  }

  private tick(_dt: number, t: number): void {
    if (!this.instancedBody || !this.instancedTail) return;
    const tmp = new THREE.Object3D();
    for (let i = 0; i < this.drifts.length; i++) {
      const d = this.drifts[i];
      const ts = t * 0.001;
      const x = d.cx + Math.sin(ts * d.speed + d.phase) * 0.8;
      const y = d.cy + Math.sin(ts * d.speed * 0.5 + d.phase * 1.3) * 0.3;
      const z = d.cz + Math.cos(ts * d.speed * 0.7 + d.phase) * 0.5;
      const yaw = d.yaw + Math.sin(ts * d.speed + d.phase) * 0.4;

      // Body
      const size = 0.35;
      tmp.position.set(x, y, z);
      tmp.rotation.set(0, yaw, 0);
      tmp.scale.setScalar(size);
      tmp.updateMatrix();
      this.instancedBody.setMatrixAt(i, tmp.matrix);

      // Tail behind body
      tmp.position.set(
        x - Math.cos(yaw) * size * 1.7,
        y,
        z - Math.sin(yaw) * size * 1.7
      );
      tmp.scale.setScalar(size * 0.7);
      tmp.updateMatrix();
      this.instancedTail.setMatrixAt(i, tmp.matrix);
    }
    this.instancedBody.instanceMatrix.needsUpdate = true;
    this.instancedTail.instanceMatrix.needsUpdate = true;
  }

  private setVisible(v: boolean): void {
    this.visible = v;
    if (this.boxHelper) this.boxHelper.visible = v;
    if (this.gradientHelper) this.gradientHelper.visible = v;
    if (this.instancedBody) this.instancedBody.visible = v;
    if (this.instancedTail) this.instancedTail.visible = v;
    if (v) {
      // Fit camera to tank.
      this.scene.camera.position.set(0, 2, TANK_SIZE.x * 1.4);
      this.scene.camera.lookAt(0, 0, 0);
    } else {
      // Return to organism-view framing.
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
