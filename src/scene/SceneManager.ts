// Three.js scene management: renderer, camera, lights, orbit controls.
// Single point of rendering truth; the three view-specific renderers
// (organism, meiosis, tank) plug into this.

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export class SceneManager {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;

  private animHandles: Array<(dt: number, t: number) => void> = [];
  private lastT: number = performance.now();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x05080c);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x05080c, 0.02);

    const { width, height } = canvas.getBoundingClientRect();
    this.camera = new THREE.PerspectiveCamera(
      50,
      Math.max(width, 1) / Math.max(height, 1),
      0.1,
      200
    );
    this.camera.position.set(0, 1.2, 4.5);
    this.camera.lookAt(0, 0, 0);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 1.2;
    this.controls.maxDistance = 40;

    this.setupLights();
    this.setupResize(canvas);
    this.renderer.setAnimationLoop((t) => this.onFrame(t));
  }

  private setupLights(): void {
    const ambient = new THREE.AmbientLight(0xaab3c0, 0.35);
    this.scene.add(ambient);

    const key = new THREE.DirectionalLight(0xcfd8e4, 1.1);
    key.position.set(5, 8, 5);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0x6a8aa4, 0.4);
    fill.position.set(-4, 3, -2);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 0.3);
    rim.position.set(0, -2, -6);
    this.scene.add(rim);
  }

  private setupResize(canvas: HTMLCanvasElement): void {
    const handle = () => this.onResize(canvas);
    window.addEventListener("resize", handle);
    const ro = new ResizeObserver(() => handle());
    ro.observe(canvas);
    handle();
  }

  private onResize(canvas: HTMLCanvasElement): void {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private onFrame(t: number): void {
    const dt = Math.min(0.1, (t - this.lastT) / 1000);
    this.lastT = t;
    this.controls.update();
    for (const fn of this.animHandles) fn(dt, t);
    this.renderer.render(this.scene, this.camera);
  }

  registerAnim(fn: (dt: number, t: number) => void): () => void {
    this.animHandles.push(fn);
    return () => {
      const i = this.animHandles.indexOf(fn);
      if (i >= 0) this.animHandles.splice(i, 1);
    };
  }

  clearAnims(): void {
    this.animHandles.length = 0;
  }

  /** Remove everything from the scene except lights. */
  clearScene(): void {
    const toRemove: THREE.Object3D[] = [];
    this.scene.traverse((obj) => {
      if (
        obj instanceof THREE.Mesh ||
        obj instanceof THREE.Group ||
        obj instanceof THREE.LineSegments
      ) {
        // Only remove top-level children; groups clean up their descendants.
        if (obj.parent === this.scene) toRemove.push(obj);
      }
    });
    for (const o of toRemove) {
      this.scene.remove(o);
      disposeTree(o);
    }
  }
}

function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry?.dispose();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) m?.dispose?.();
    }
  });
}
