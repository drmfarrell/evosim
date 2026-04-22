// Renders a single creature on a pedestal/floating platform. Subscribes
// to SimState.selected; when it changes, the mesh is rebuilt.

import * as THREE from "three";
import { SceneManager } from "./SceneManager";
import { buildFishMesh, PhenotypeValues } from "./CreatureMesh";
import { SimState, CreatureJson } from "../state/SimState";
import { computePhenotype } from "../utils/phenotype";

export class OrganismRenderer {
  private currentMesh: THREE.Group | null = null;
  private unsubs: Array<() => void> = [];
  private unsubAnim: (() => void) | null = null;

  constructor(
    private scene: SceneManager,
    private state: SimState,
    private archetype: any
  ) {
    this.unsubs.push(
      state.onSelected.subscribe((c) => this.rebuild(c))
    );
    this.unsubs.push(
      state.onHoverLocus.subscribe((loc) => this.applyHover(loc))
    );
    this.unsubs.push(
      state.onView.subscribe((v) => this.setVisible(v === "organism"))
    );
    this.rebuild(state.selected);
    this.setVisible(state.view === "organism");
  }

  private setVisible(v: boolean): void {
    if (this.currentMesh) this.currentMesh.visible = v;
  }

  private rebuild(c: CreatureJson | null): void {
    if (this.currentMesh) {
      this.scene.scene.remove(this.currentMesh);
      disposeGroup(this.currentMesh);
      this.currentMesh = null;
    }
    if (this.unsubAnim) {
      this.unsubAnim();
      this.unsubAnim = null;
    }
    if (!c) return;

    const ph = computePhenotype(c, this.archetype) as PhenotypeValues;
    const isMale = c.sex === "male";
    const mesh = buildFishMesh(ph, isMale);
    mesh.position.y = 0;
    mesh.visible = this.state.view === "organism";

    // Idle gentle bob.
    this.unsubAnim = this.scene.registerAnim((_dt, t) => {
      if (!mesh) return;
      mesh.position.y = Math.sin(t * 0.0015) * 0.05;
      mesh.rotation.y = Math.sin(t * 0.0007) * 0.12;
    });

    this.scene.scene.add(mesh);
    this.currentMesh = mesh;
  }

  private applyHover(channelForLocus: string | null): void {
    if (!this.currentMesh) return;
    this.currentMesh.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const isTarget =
        channelForLocus != null && obj.userData.channel === channelForLocus;
      const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
      if (!(mat instanceof THREE.MeshStandardMaterial)) return;
      mat.emissive = isTarget
        ? new THREE.Color(0x3a86ff)
        : new THREE.Color(0x000000);
      mat.emissiveIntensity = isTarget ? 0.45 : 0;
    });
  }

  dispose(): void {
    for (const u of this.unsubs) u();
    this.unsubs = [];
    if (this.unsubAnim) this.unsubAnim();
    if (this.currentMesh) {
      this.scene.scene.remove(this.currentMesh);
      disposeGroup(this.currentMesh);
    }
  }
}

function disposeGroup(g: THREE.Group): void {
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry?.dispose();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) m?.dispose?.();
    }
  });
}
