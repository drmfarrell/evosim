// Procedural fish mesh built from primitives. Phenotype channels drive
// per-instance transforms and color. Deliberately low-poly and
// naturalistic — no cartoon faces, no saturated colors. See
// EVOSIM_SPEC §3.8 and §5.4.

import * as THREE from "three";

/** Per-channel phenotype values (after any jitter) that drive mesh
 *  appearance. Channels not present fall back to archetype midpoints. */
export type PhenotypeValues = {
  body_color_hue?: number;        // 0 (dark) .. 1 (light)
  body_size?: number;              // scale factor, ~0.6 .. 1.5
  body_shape_streamlined?: number; // 0 (deep body) .. 1 (streamlined)
  dorsal_fin_size?: number;        // 0 .. 1
  coat_pattern?: number;           // 0 (solid) .. 1 (striped)
  metabolic_rate?: number;
  mating_display_intensity?: number; // 0 .. 1
  eye_color?: number;              // 0 .. 1
  combat_weapon?: number;          // 0 (absent) .. 1 (present)
};

/** Build a new fish group with geometry reflecting the given phenotype. */
export function buildFishMesh(ph: PhenotypeValues, isMale: boolean = true): THREE.Group {
  const group = new THREE.Group();

  const size = clamp(ph.body_size ?? 1.0, 0.5, 2.0);
  const streamlined = clamp(ph.body_shape_streamlined ?? 0.5, 0, 1);
  const hue = clamp(ph.body_color_hue ?? 0.4, 0, 1);
  const dorsal = clamp(ph.dorsal_fin_size ?? 0.6, 0, 1);
  const pattern = clamp(ph.coat_pattern ?? 0.0, 0, 1);
  const display = clamp(ph.mating_display_intensity ?? 0.0, 0, 1);
  const eyeCol = clamp(ph.eye_color ?? 0.2, 0, 1);
  const weapon = clamp(ph.combat_weapon ?? 0.0, 0, 1);

  // Body: ellipsoid, longer on streamlined axis.
  const bodyLenX = 1.2 + 0.8 * streamlined;
  const bodyLenY = 0.6 - 0.25 * streamlined + (1 - streamlined) * 0.1;
  const bodyLenZ = 0.32 + 0.08 * (1 - streamlined);

  const bodyGeom = new THREE.SphereGeometry(1, 16, 12);
  bodyGeom.scale(bodyLenX, bodyLenY, bodyLenZ);
  const bodyMat = makeBodyMaterial(hue, pattern, display && isMale ? display : 0);
  const body = new THREE.Mesh(bodyGeom, bodyMat);
  body.name = "body";
  body.userData.channel = "body_color_hue";
  group.add(body);

  // Tail fin: flat triangle.
  const tailShape = new THREE.Shape();
  const tailLen = 0.6 + 0.3 * streamlined;
  tailShape.moveTo(0, 0);
  tailShape.lineTo(tailLen, 0.45);
  tailShape.lineTo(tailLen, -0.45);
  tailShape.lineTo(0, 0);
  const tailGeom = new THREE.ShapeGeometry(tailShape);
  const tailMat = makeFinMaterial(hue);
  const tail = new THREE.Mesh(tailGeom, tailMat);
  tail.rotation.y = Math.PI / 2;
  tail.position.x = -bodyLenX;
  tail.name = "tail";
  group.add(tail);

  // Dorsal fin: on top, scaled by dorsal gene.
  if (dorsal > 0.05) {
    const dorsalShape = new THREE.Shape();
    const h = 0.3 + 0.7 * dorsal;
    dorsalShape.moveTo(-0.4, 0);
    dorsalShape.quadraticCurveTo(0, h, 0.4, 0);
    const dorsalGeom = new THREE.ShapeGeometry(dorsalShape);
    const dorsalMat = makeFinMaterial(hue);
    const dorsalFin = new THREE.Mesh(dorsalGeom, dorsalMat);
    dorsalFin.rotation.y = Math.PI / 2;
    dorsalFin.position.y = bodyLenY * 0.95;
    dorsalFin.position.x = -0.1;
    dorsalFin.name = "dorsal_fin";
    dorsalFin.userData.channel = "dorsal_fin_size";
    group.add(dorsalFin);
  }

  // Pectoral fins: pair, small, slightly animated-looking.
  for (const sign of [-1, 1]) {
    const pecShape = new THREE.Shape();
    pecShape.moveTo(0, 0);
    pecShape.lineTo(0.3, 0.18);
    pecShape.lineTo(0.35, -0.1);
    pecShape.lineTo(0, 0);
    const pecGeom = new THREE.ShapeGeometry(pecShape);
    const pec = new THREE.Mesh(pecGeom, makeFinMaterial(hue));
    pec.rotation.x = sign * 0.3;
    pec.position.set(0.35, -0.1, sign * (bodyLenZ + 0.02));
    pec.name = "pectoral_fin";
    group.add(pec);
  }

  // Combat spine: small horn on snout if expressed.
  if (weapon > 0.5) {
    const spineGeom = new THREE.ConeGeometry(0.06, 0.35, 8);
    const spineMat = new THREE.MeshStandardMaterial({
      color: 0xb8ae9e,
      roughness: 0.7,
    });
    const spine = new THREE.Mesh(spineGeom, spineMat);
    spine.rotation.z = -Math.PI / 2;
    spine.position.set(bodyLenX + 0.15, 0, 0);
    spine.name = "combat_spine";
    spine.userData.channel = "combat_weapon";
    group.add(spine);
  }

  // Eyes: two small spheres.
  for (const sign of [-1, 1]) {
    const eyeGeom = new THREE.SphereGeometry(0.06, 8, 6);
    const eyeMat = new THREE.MeshStandardMaterial({
      color: eyeColorFromValue(eyeCol),
      roughness: 0.3,
    });
    const eye = new THREE.Mesh(eyeGeom, eyeMat);
    eye.position.set(bodyLenX * 0.75, bodyLenY * 0.15, sign * bodyLenZ);
    eye.name = "eye";
    eye.userData.channel = "eye_color";
    group.add(eye);
  }

  group.scale.setScalar(size);
  return group;
}

function makeBodyMaterial(hue: number, pattern: number, display: number): THREE.MeshStandardMaterial {
  // Base color: earthy dark-to-light. Avoid saturated primaries.
  const dark = new THREE.Color(0x1b2230); // deep bluish gray
  const light = new THREE.Color(0xbdc2b2); // pale sand
  const base = dark.clone().lerp(light, hue);

  // Display overlay: subtle warm glow on breeding males.
  if (display > 0) {
    const displayColor = new THREE.Color(0xd98040);
    base.lerp(displayColor, display * 0.3);
  }

  const mat = new THREE.MeshStandardMaterial({
    color: base.getHex(),
    roughness: 0.7,
    metalness: 0.05,
  });

  // Pattern is encoded as a simple speckled/striped attribute in the
  // material name for v0; real pattern textures arrive in Phase 2.
  if (pattern > 0.3) {
    mat.name = pattern > 0.7 ? "pattern_striped" : "pattern_spotted";
  } else {
    mat.name = "pattern_solid";
  }

  return mat;
}

function makeFinMaterial(hue: number): THREE.MeshStandardMaterial {
  const base = new THREE.Color(0x1b2230).lerp(new THREE.Color(0xbdc2b2), hue);
  return new THREE.MeshStandardMaterial({
    color: base.getHex(),
    roughness: 0.6,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
  });
}

function eyeColorFromValue(v: number): number {
  // 0 = dark (brown/black), 1 = light (pale blue).
  const dark = new THREE.Color(0x2b1a10);
  const light = new THREE.Color(0x6a8aa4);
  return dark.clone().lerp(light, v).getHex();
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
