import {
  AmbientLight,
  DirectionalLight,
  NoToneMapping,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
  type Object3D,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export interface LookScene {
  scene: Scene;
  compile: (object: Object3D) => Promise<unknown>;
  /** Draws a frame, after the scene changed */
  invalidate: () => void;
  dispose: () => void;
}

/** Lit like Paracausal Forge, tone mapping and bright environments shift dye colors */
export const createLookScene = (canvas: HTMLCanvasElement): LookScene => {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });

  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.toneMapping = NoToneMapping;
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  const environment = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();

  scene.environment = environment.fromScene(room, 0.04).texture;
  scene.environmentIntensity = 0.5;

  const key = new DirectionalLight(0xff_ffff, 4);

  key.position.set(1, 2, 1.5);

  const rim = new DirectionalLight(0xff_ffff, 1.5);

  rim.position.set(-1.5, 1, -2);
  scene.add(key, rim, new AmbientLight(0x40_4040, 1));

  const camera = new PerspectiveCamera(35, 1, 0.05, 100);

  camera.position.set(0, 1.2, 3.6);

  const controls = new OrbitControls(camera, canvas);

  controls.target.set(0, 0.95, 0);
  controls.enableDamping = true;

  let animating = false;

  // Keeps going while damping settles
  const frame = () => {
    const moving = controls.update();

    renderer.render(scene, camera);

    if (!moving) {
      animating = false;
      renderer.setAnimationLoop(null);
    }
  };

  const invalidate = () => {
    if (animating) {
      return;
    }

    animating = true;
    renderer.setAnimationLoop(frame);
  };

  controls.addEventListener("change", invalidate);

  const resize = () => {
    const { clientWidth, clientHeight } = canvas;

    if (clientWidth === 0 || clientHeight === 0) {
      return;
    }

    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    invalidate();
  };
  const observer = new ResizeObserver(resize);

  observer.observe(canvas);

  return {
    scene,
    compile: (object) => renderer.compileAsync(object, camera, scene),
    invalidate,
    dispose: () => {
      renderer.setAnimationLoop(null);
      controls.removeEventListener("change", invalidate);
      observer.disconnect();
      controls.dispose();
      scene.environment?.dispose();
      room.dispose();
      environment.dispose();
      renderer.dispose();
    },
  };
};
