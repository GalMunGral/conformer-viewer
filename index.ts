import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import * as THREE from "three";

const slider = document.querySelector(
  'input[type="range"]'
) as HTMLInputElement;

slider.min = "0";
slider.max = "99";
slider.step = "1";

const OFFSET = 8;
const SCALE_DOWN = 0.75;
const DEAFULT_OPACITY = 0.003;

// Instantiate a loader
const loader = new GLTFLoader();

// Optional: Provide a DRACOLoader instance to decode compressed mesh data
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("/draco/");
loader.setDRACOLoader(dracoLoader);

const scene = new THREE.Scene();

// const light = new THREE.AmbientLight(0xffffff, 1); // soft white light
// scene.add(light);

// const axesHelper = new THREE.AxesHelper(5);
// scene.add(axesHelper);

let transparency = true;
const lineSegments: THREE.LineSegments[] = [];

// Load a glTF resource
loader.load(
  // resource URL
  "test.gltf",
  //   "GBCA/GBCA_ensembles.gltf",
  // "nanotube/nanotube_.gltf",
  // called when the resource is loaded
  function (gltf) {
    gltf.animations; // Array<THREE.AnimationClip>
    gltf.scene; // THREE.Group
    gltf.scenes; // Array<THREE.Group>
    gltf.cameras; // Array<THREE.Camera>
    gltf.asset; // Object

    gltf.scene.renderOrder = 1;

    scene.add(gltf.scene);
    scene.traverse((object) => {
      if (object instanceof THREE.LineSegments) {
        lineSegments.push(object);
      }
    });

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.append(renderer.domElement);

    // const camera = gltf.cameras[0] || new THREE.PerspectiveCamera();
    const camera = new THREE.PerspectiveCamera();
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = 75;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.near = 0.1;
      camera.far = 1000;
      camera.updateProjectionMatrix();
    }

    let meshes: THREE.Object3D[] = [];
    let points = [];

    (function getBoundingBox(object: THREE.Object3D) {
      if (object instanceof THREE.Mesh) {
        meshes.push(object);
        object.geometry.computeBoundingBox();
        const { min, max } = object.geometry.boundingBox!;
        points.push(min.add(max).multiplyScalar(0.1));

        if (
          transparency &&
          object.material instanceof THREE.MeshStandardMaterial
        ) {
          object.material.transparent = true;
          object.material.blending = THREE.AdditiveBlending;
          // object.material.opacity = 0.1;
        }
      } else if (object instanceof THREE.LineSegments) {
        meshes.push(object);
        object.geometry.computeBoundingBox();
        const { min, max } = object.geometry.boundingBox!;
        points.push(min.add(max).multiplyScalar(0.5));

        if (object.material instanceof THREE.LineBasicMaterial) {
          object.material.transparent = true;
          object.material.depthWrite = false;
          object.material.blending = THREE.AdditiveBlending;
          object.material.opacity = DEAFULT_OPACITY;
        }
      }
      object.children?.forEach(getBoundingBox);
    })(scene);

    let center = points
      .reduce((c, p) => c.add(p), new THREE.Vector3())
      .multiplyScalar(1 / points.length);

    const offset = 15;
    camera.position.set(
      center.x + offset,
      center.y + offset,
      center.z + offset
    );
    camera.up = new THREE.Vector3(0, 0, 1);
    camera.lookAt(center);

    // White directional light at half intensity shining from the top.
    // const directionalLight = new THREE.DirectionalLight(0xffffff);
    // directionalLight.position.set(center.x + 1000, center.y + 1000, center.z);
    // scene.add(directionalLight);

    let pointerDown = false;
    let prevX = -1;
    let prevY = -1;
    renderer.domElement.addEventListener("pointerdown", (e) => {
      pointerDown = true;
      prevX = e.clientX;
      prevY = e.clientY;
    });
    renderer.domElement.addEventListener(
      "pointerup",
      () => (pointerDown = false)
    );
    renderer.domElement.addEventListener("pointermove", (e) => {
      if (pointerDown) {
        function unproject(x: number, y: number) {
          const rect = renderer.domElement.getBoundingClientRect();
          const z = camera.position
            .clone()
            // .normalize()
            .multiplyScalar(1 / 10)
            .project(camera).z;

          return new THREE.Vector3(
            ((x - rect.left) / rect.width) * 2 - 1,
            ((rect.bottom - y) / rect.height) * 2 - 1,
            z
          ).unproject(camera);
        }

        const axis = unproject(e.clientX, e.clientY)
          .sub(unproject(prevX, prevY))
          .cross(camera.getWorldDirection(new THREE.Vector3()))
          .normalize();

        scene.rotateOnWorldAxis(axis, 0.04);

        prevX = e.clientX;
        prevY = e.clientY;
      }
    });

    function updateOpacity() {
      for (let [i, line] of lineSegments.entries()) {
        const m = line.material as THREE.LineBasicMaterial;
        m.opacity = i === +slider.value ? 0.05 : 0;
      }
    }
    function resetOpacity() {
      for (let [i, line] of lineSegments.entries()) {
        const m = line.material as THREE.LineBasicMaterial;
        m.opacity = DEAFULT_OPACITY;
      }
    }
    slider.oninput = () => {
      updateOpacity();
    };

    let start = -1;
    const pressed: Record<string, boolean> = {};
    window.onkeydown = (e) => {
      pressed[e.key] = true;
    };

    window.onkeyup = (e) => {
      pressed[e.key] = false;
      if (e.key === " ") {
        resetOpacity();
        start = Date.now();
      }
    };
    for (let mesh of lineSegments) {
      mesh.userData["scale"] = 0.5 + Math.random();
      mesh.userData["dir"] = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ).normalize();
    }

    let prev = -1;
    function animate() {
      const t = Date.now();
      if (start > -1) {
        const psi = 0.0025 * (Date.now() - start);
        const u =
          0.5 * (Math.sin(-Math.PI / 2 + Math.min(2 * Math.PI, psi)) + 1);
        scene.traverse((object) => {
          if (object instanceof THREE.LineSegments) {
            const s = 1 - SCALE_DOWN * u;
            object.scale.set(s, s, s);
            object.material.opacity =
              DEAFULT_OPACITY + (0.005 - DEAFULT_OPACITY) * u;
            const p = object.userData["dir"]
              .clone()
              .multiplyScalar(object.userData["scale"] * OFFSET * u);
            object.position.set(p.x, p.y, p.z);
          }
        });
        if (psi > Math.PI * 2) {
          start = -1;
        }
      }
      if (!pointerDown) {
        scene.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), 0.01);
      }
      if (prev < 0) prev = t;

      const d = 0.01 * (t - prev);

      //   const theta = 0.0008 * (t - prev);
      //   if (pressed["ArrowDown"])
      //     camera.rotateOnAxis(new THREE.Vector3(1, 0, 0), -theta);
      //   if (pressed["ArrowUp"])
      //     camera.rotateOnAxis(new THREE.Vector3(1, 0, 0), theta);
      //   if (pressed["ArrowLeft"])
      //     camera.rotateOnAxis(new THREE.Vector3(0, 1, 0), theta);
      //   if (pressed["ArrowRight"])
      //     camera.rotateOnAxis(new THREE.Vector3(0, 1, 0), -theta);
      //   if (pressed["q"]) camera.rotateOnAxis(new THREE.Vector3(0, 0, 1), theta);
      //   if (pressed["e"]) camera.rotateOnAxis(new THREE.Vector3(0, 0, 1), -theta);
      if (pressed["w"]) camera.translateZ(-d);
      if (pressed["s"]) camera.translateZ(d);
      if (pressed["d"]) camera.translateX(d);
      if (pressed["a"]) camera.translateX(-d);
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
      prev = t;
    }

    requestAnimationFrame(animate);
  },
  // called while loading is progressing
  function (xhr) {
    // console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
  },
  // called when loading has errors
  function (error) {
    console.log(error);
  }
);
