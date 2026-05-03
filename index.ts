import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {ArcballControls} from "three/addons/controls/ArcballControls.js";
import * as THREE from "three";

const CAMERA_OFFSET = 25;
const SCALE_DOWN = 0.8;
const FOG_ENSEMBLE = 0.001;
const FOG_EXPLODED = 0.03;
const FULL_OPACITY = 0.8;

const loader = new GLTFLoader();

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, FOG_ENSEMBLE);
scene.add(new THREE.AxesHelper(5));

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.append(renderer.domElement);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, CAMERA_OFFSET);
camera.lookAt(new THREE.Vector3());

const controls = new ArcballControls(camera, renderer.domElement, scene);
controls.setGizmosVisible(true);

let lineSegments: THREE.LineSegments[] = [];
let dirs: THREE.Vector3[] = [];
let explodedOpacities: number[] = [];
let ensembleOpacity = 1;
let currentGltfScene: THREE.Group | null = null;
let start = -1;
let expanded = false;

window.onkeyup = (e) => {
  if (e.key === " " && start === -1) {
    expanded = !expanded;
    start = Date.now();
  }
};

function loadEnsemble(filename: string) {
  start = -1;
  expanded = false;
  (scene.fog as THREE.FogExp2).density = FOG_ENSEMBLE;
  if (currentGltfScene) {
    scene.remove(currentGltfScene);
    lineSegments = [];
    dirs = [];
    explodedOpacities = [];
  }
  loader.load(
    filename,
    function (gltf) {
      currentGltfScene = gltf.scene;
      gltf.scene.renderOrder = 1;
      scene.add(gltf.scene);
      gltf.scene.traverse((object) => {
        if (object.type === "LineSegments") {
          lineSegments.push(object as THREE.LineSegments);
        } else if (object.type === "Mesh") {
          object.visible = false;
        }
      });

      // Bin each bond by (midpoint, direction). Within one molecule, no two bonds
      // occupy the same bin, so bin count = number of overlapping molecules/conformers.
      // Local max per object → per-object exploded opacity.
      // Global max (counts summed across all objects) → ensemble opacity.
      const POS_BIN = 1e-1;
      const DIR_BIN = 1e-3;
      const globalBins = new Map<string, number>();

      for (const ls of lineSegments) {
        const localBins = new Map<string, number>();
        const pos = ls.geometry.attributes.position;
        for (let i = 0; i < pos.count - 1; i += 2) {
          const a = new THREE.Vector3().fromBufferAttribute(pos, i);
          const b = new THREE.Vector3().fromBufferAttribute(pos, i + 1);
          const mid = a.clone().add(b).multiplyScalar(0.5);
          let dir = b.clone().sub(a).normalize();
          // Canonical direction: A→B and B→A are the same bond.
          if (dir.x < 0 || (dir.x === 0 && dir.y < 0) || (dir.x === 0 && dir.y === 0 && dir.z < 0)) dir.negate();
          const mx = Math.round(mid.x / POS_BIN);
          const my = Math.round(mid.y / POS_BIN);
          const mz = Math.round(mid.z / POS_BIN);
          const dx = Math.round(dir.x / DIR_BIN);
          const dy = Math.round(dir.y / DIR_BIN);
          const dz = Math.round(dir.z / DIR_BIN);
          const key = `${mx},${my},${mz},${dx},${dy},${dz}`;
          localBins.set(key, (localBins.get(key) ?? 0) + 1);
          globalBins.set(key, (globalBins.get(key) ?? 0) + 1);
        }
        let localMax = 1;
        for (const count of localBins.values()) {
          if (count > localMax) localMax = count;
        }
        explodedOpacities.push(FULL_OPACITY / localMax);
      }

      let globalMax = 1;
      for (const count of globalBins.values()) {
        if (count > globalMax) globalMax = count;
      }
      ensembleOpacity = FULL_OPACITY / globalMax;
      console.log("globalMax:", globalMax, "ensembleOpacity:", ensembleOpacity);

      const N = Math.round(Math.cbrt(lineSegments.length));
      for (const [i, ls] of lineSegments.entries()) {
        if (ls.material instanceof THREE.LineBasicMaterial) {
          ls.material.transparent = true;
          ls.material.depthWrite = false;
          ls.material.blending = THREE.AdditiveBlending;
          ls.material.opacity = ensembleOpacity;
        }
        const x = i % N;
        const y = Math.floor(i / N) % N;
        const z = Math.floor(i / (N * N));
        dirs.push(new THREE.Vector3(x - (N - 1) / 2, y - (N - 1) / 2, z - (N - 1) / 2));
      }
    },
    () => {
    },
    (error) => console.log(error)
  );
}

let prev = -1;

function animate() {
  const t = Date.now();
  if (start > -1) {
    const psi = 0.005 * (t - start);
    const u = 0.5 * (Math.sin(((expanded ? -1 : 1) * Math.PI) / 2 + Math.min(Math.PI, psi)) + 1);
    for (const [i, ls] of lineSegments.entries()) {
      const s = 1 - SCALE_DOWN * u;
      ls.scale.set(s, s, s);
      (ls.material as THREE.LineBasicMaterial).opacity = ensembleOpacity + (explodedOpacities[i] - ensembleOpacity) * u;
      const p = dirs[i].clone().multiplyScalar(5 * u);
      ls.position.set(p.x, p.y, p.z);
    }
    (scene.fog as THREE.FogExp2).density = FOG_ENSEMBLE + (FOG_EXPLODED - FOG_ENSEMBLE) * u;
    if (psi > Math.PI) start = -1;
  }
  for (const ls of lineSegments) {
    ls.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), 0.001 * (t - prev));
  }
  if (prev < 0) prev = t;
  controls.update();
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
  prev = t;
}

requestAnimationFrame(animate);

const select = document.querySelector("select") as HTMLSelectElement;
select.onchange = () => {
  loadEnsemble(select.value);
  select.blur();
};
loadEnsemble(select.value);
