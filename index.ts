import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import * as THREE from "three";

const slider = document.querySelector(
  'input[type="range"]'
) as HTMLInputElement;

slider.min = "0";
slider.max = "99";
slider.step = "1";

const CAMERA_OFFSET = 25;
const SCALE_DOWN = 0.8;
const DEAFULT_OPACITY = 0.003;
const TARGET_OPACITY = 0.05;

// Instantiate a loader
const loader = new GLTFLoader();

// Optional: Provide a DRACOLoader instance to decode compressed mesh data
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("/draco/");
loader.setDRACOLoader(dracoLoader);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.001);

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

    camera.position.set(0, -CAMERA_OFFSET, 0);
    camera.up = new THREE.Vector3(0, 0, 1);
    camera.lookAt(new THREE.Vector3());

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
            .multiplyScalar(0.2)
            .project(camera).z;

          return new THREE.Vector3(
            ((x - rect.left) / rect.width) * 2 - 1,
            ((rect.bottom - y) / rect.height) * 2 - 1,
            z
          )
            .unproject(camera)
            .normalize();
        }

        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(
          unproject(prevX, prevY),
          unproject(e.clientX, e.clientY)
        );

        scene.applyQuaternion(quaternion);

        prevX = e.clientX;
        prevY = e.clientY;
      }
    });

    function updateOpacity() {
      for (let [i, line] of lineSegments.entries()) {
        const m = line.material as THREE.LineBasicMaterial;
        m.opacity = i === +slider.value ? TARGET_OPACITY : 0;
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

    let expanded = false;
    window.onkeyup = (e) => {
      pressed[e.key] = false;
      if (e.key === " " && start == -1) {
        expanded = !expanded;
        resetOpacity();
        start = Date.now();
      }
    };

    function sampleSphere() {
      let res = new THREE.Vector3(1, 1, 1);
      while (res.length() > 1) {
        res = new THREE.Vector3(
          2 * Math.random() - 1,
          2 * Math.random() - 1,
          2 * Math.random() - 1
        );
      }
      return res.normalize();
    }
    const N = Math.round(Math.sqrt(lineSegments.length));
    for (let [i, mesh] of lineSegments.entries()) {
      const x = i % N;
      const y = Math.floor(i / N);
      // mesh.userData["scale"] = 0.5 + Math.random();
      mesh.userData["scale"] = 5;
      // mesh.userData["dir"] = sampleSphere();
      mesh.userData["dir"] = new THREE.Vector3(
        x - (N - 1) / 2,
        0,
        (N - 1) / 2 - y
      );
    }

    let prev = -1;
    function animate() {
      const t = Date.now();
      if (start > -1) {
        const psi = 0.005 * (Date.now() - start);
        const u =
          0.5 *
          (Math.sin(
            ((expanded ? -1 : 1) * Math.PI) / 2 + Math.min(Math.PI, psi)
          ) +
            1);

        scene.traverse((object) => {
          if (object instanceof THREE.LineSegments) {
            const s = 1 - SCALE_DOWN * u;
            object.scale.set(s, s, s);
            object.material.opacity =
              DEAFULT_OPACITY + (TARGET_OPACITY - DEAFULT_OPACITY) * u ** 10;
            const p = object.userData["dir"]
              .clone()
              .multiplyScalar(object.userData["scale"] * u);
            object.position.set(p.x, p.y, p.z);
          }
        });
        if (psi > Math.PI) {
          start = -1;
        }
      }
      if (!pointerDown) {
        // scene.rotateOnWorldAxis(
        //   new THREE.Vector3(0, 0, 1),
        //   0.0005 * (t - prev)
        // );
        lineSegments.forEach((mesh) => {
          mesh.rotateOnWorldAxis(
            new THREE.Vector3(0, 0, 1),
            0.001 * (t - prev)
          );
        });
      }
      if (prev < 0) prev = t;

      const d = 0.05 * (t - prev);

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
      if (pressed["w"]) camera.position.y += d;
      if (pressed["s"]) camera.position.y -= d;
      if (pressed["ArrowLeft"]) camera.position.x -= d;
      if (pressed["ArrowRight"]) camera.position.x += d;
      if (pressed["ArrowUp"]) camera.position.z += d;
      if (pressed["ArrowDown"]) camera.position.z -= d;
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
