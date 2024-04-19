import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import * as THREE from "three";

// Instantiate a loader
const loader = new GLTFLoader();

// Optional: Provide a DRACOLoader instance to decode compressed mesh data
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("/draco/");
loader.setDRACOLoader(dracoLoader);

const scene = new THREE.Scene();

const light = new THREE.AmbientLight(0xffffff, 0.4); // soft white light
scene.add(light);

const axesHelper = new THREE.AxesHelper(5);
scene.add(axesHelper);

let transparency = true;

// Load a glTF resource
loader.load(
  // resource URL
  "GBCA/GBCA_ensembles.gltf",
  // "nanotube/nanotube_.gltf",
  // called when the resource is loaded
  function (gltf) {
    console.log(gltf);
    scene.add(gltf.scene);

    gltf.animations; // Array<THREE.AnimationClip>
    gltf.scene; // THREE.Group
    gltf.scenes; // Array<THREE.Group>
    gltf.cameras; // Array<THREE.Camera>
    gltf.asset; // Object

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.append(renderer.domElement);

    const camera = gltf.cameras[0];
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    }

    let objects: THREE.Object3D[] = [];
    let points = [];

    (function getBoundingBox(object: THREE.Object3D) {
      if (object instanceof THREE.Mesh) {
        objects.push(object);
        object.geometry.computeBoundingBox();
        const { min, max } = object.geometry.boundingBox!;
        points.push(min.add(max).multiplyScalar(0.1));

        if (
          transparency &&
          object.material instanceof THREE.MeshStandardMaterial
        ) {
          object.material.transparent = true;
          object.material.blending = THREE.AdditiveBlending;
          object.material.opacity = 0.1;
        }
      } else if (object instanceof THREE.LineSegments) {
        objects.push(object);
        object.geometry.computeBoundingBox();
        const { min, max } = object.geometry.boundingBox!;
        points.push(min.add(max).multiplyScalar(0.5));

        if (object.material instanceof THREE.LineBasicMaterial) {
          object.material.transparent = true;
          object.material.blending = THREE.AdditiveBlending;
          object.material.opacity = 0.1;
        }
      }
      object.children?.forEach(getBoundingBox);
    })(scene);

    let center = points
      .reduce((c, p) => c.add(p))
      .multiplyScalar(1 / points.length);

    const offset = 50;
    camera.position.set(
      center.x + offset,
      center.y + offset,
      center.z + offset
    );
    camera.lookAt(center);

    // White directional light at half intensity shining from the top.
    const directionalLight = new THREE.DirectionalLight(0xffffff);
    directionalLight.position.set(center.x + 1000, center.y + 1000, center.z);
    scene.add(directionalLight);

    let pointerDown = false;
    let prevX = -1;
    let prevY = -1;
    window.addEventListener("pointerdown", (e) => {
      pointerDown = true;
      prevX = e.clientX;
      prevY = e.clientY;
    });
    window.addEventListener("pointerup", () => (pointerDown = false));
    window.addEventListener("pointermove", (e) => {
      if (pointerDown) {
        function unproject(x: number, y: number) {
          const rect = renderer.domElement.getBoundingClientRect();
          const z = camera.position
            .clone()
            .normalize()
            .multiplyScalar(1.5)
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

        objects.forEach((o) => o.rotateOnWorldAxis(axis, 0.04));

        prevX = e.clientX;
        prevY = e.clientY;
      }
    });

    const pressed: Record<string, boolean> = {};
    window.onkeydown = (e) => (pressed[e.key] = true);
    window.onkeyup = (e) => (pressed[e.key] = false);

    let prev = -1;
    function animate(t: number) {
      if (prev < 0) prev = t;
      const theta = 0.0008 * (t - prev);

      const d = 0.01 * (t - prev);
      if (pressed["ArrowDown"])
        camera.rotateOnAxis(new THREE.Vector3(1, 0, 0), -theta);
      if (pressed["ArrowUp"])
        camera.rotateOnAxis(new THREE.Vector3(1, 0, 0), theta);
      if (pressed["ArrowLeft"])
        camera.rotateOnAxis(new THREE.Vector3(0, 1, 0), theta);
      if (pressed["ArrowRight"])
        camera.rotateOnAxis(new THREE.Vector3(0, 1, 0), -theta);
      if (pressed["q"]) camera.rotateOnAxis(new THREE.Vector3(0, 0, 1), theta);
      if (pressed["e"]) camera.rotateOnAxis(new THREE.Vector3(0, 0, 1), -theta);
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
    console.log("An error happened");
  }
);
