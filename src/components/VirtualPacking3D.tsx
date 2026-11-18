import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { PackedUnitPlacement, SuitcaseConfig } from "../types";
import { canPlaceBox } from "../utils/autoPackEngine";
import { calculateLuggageMath, round1 } from "../utils/mathEngine";

interface VirtualPacking3DProps {
  suitcase: SuitcaseConfig;
  placements: PackedUnitPlacement[];
  selectedUnitKey: string | null;
  onSelectUnit: (unitKey: string | null) => void;
  onMoveUnit: (unitKey: string, newX: number, newY: number, newZ: number) => void;
  manualDragEnabled: boolean;
  explodeFactor: number; // 0 to 1
  lidOpen: boolean;
  cameraPreset: "iso" | "top" | "front" | "side";
  onCollisionFeedback?: (msg: string | null) => void;
}

const SCALE = 0.04; // 1 cm = 0.04 world units

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) return true;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createLiningTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#5b4a3f";
  ctx.fillRect(0, 0, 256, 256);

  // Subtle quilted diamond weave
  ctx.strokeStyle = "rgba(246, 240, 231, 0.16)";
  ctx.lineWidth = 1.5;
  for (let i = -256; i < 512; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 256, 256);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(i + 256, 0);
    ctx.lineTo(i, 256);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function createFabricTexture(baseHex: string, maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 128, 128);

  // Fine woven fabric crosshatch + fold seam stripe
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  for (let y = 0; y < 128; y += 8) {
    ctx.fillRect(0, y, 128, 2);
  }
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  for (let x = 0; x < 128; x += 8) {
    ctx.fillRect(x, 0, 2, 128);
  }
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fillRect(0, 60, 128, 6);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function buildItemMeshGroup(
  placement: PackedUnitPlacement,
  isSelected: boolean,
  isColliding: boolean,
  maxAniso: number
): THREE.Group {
  const group = new THREE.Group();
  const sx = Math.max(0.05, placement.dimX * SCALE);
  const sy = Math.max(0.04, placement.dimY * SCALE);
  const sz = Math.max(0.05, placement.dimZ * SCALE);

  const baseColor = new THREE.Color(placement.colorHex);
  const emissiveHex = isColliding
    ? 0xef4444
    : isSelected
    ? 0xd4612f
    : 0x000000;
  const emissiveInt = isColliding ? 0.45 : isSelected ? 0.35 : 0;

  if (placement.category === "Shoes") {
    const soleMat = new THREE.MeshStandardMaterial({
      color: 0xf6f0e7,
      roughness: 0.7,
      metalness: 0.05,
      emissive: emissiveHex,
      emissiveIntensity: emissiveInt,
    });
    const upperMat = new THREE.MeshStandardMaterial({
      color: baseColor,
      roughness: 0.55,
      metalness: 0.1,
      emissive: emissiveHex,
      emissiveIntensity: emissiveInt,
    });

    const shoeLen = sx * 0.94;
    const shoeW = sz * 0.43;
    const soleH = sy * 0.25;
    const upperH = sy * 0.68;

    for (const side of [-1, 1]) {
      const zOff = side * (sz * 0.24);
      const sole = new THREE.Mesh(
        new THREE.BoxGeometry(shoeLen, soleH, shoeW),
        soleMat
      );
      sole.position.set(0, -sy / 2 + soleH / 2, zOff);
      sole.castShadow = true;
      sole.receiveShadow = true;

      const heel = new THREE.Mesh(
        new THREE.BoxGeometry(shoeLen * 0.56, upperH, shoeW * 0.94),
        upperMat
      );
      heel.position.set(-shoeLen * 0.18 * side, -sy / 2 + soleH + upperH / 2, zOff);
      heel.castShadow = true;

      const toe = new THREE.Mesh(
        new THREE.BoxGeometry(shoeLen * 0.42, upperH * 0.55, shoeW * 0.9),
        upperMat
      );
      toe.position.set(shoeLen * 0.25 * side, -sy / 2 + soleH + upperH * 0.28, zOff);
      toe.castShadow = true;

      group.add(sole, heel, toe);
    }
  } else if (placement.shape === "cylinder") {
    const dims = [
      { axis: "x", val: sx },
      { axis: "y", val: sy },
      { axis: "z", val: sz },
    ].sort((a, b) => a.val - b.val);

    const radius = Math.max(0.02, Math.min(dims[0].val, dims[1].val) * 0.46);
    const length = Math.max(0.05, dims[2].val * 0.95);

    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: baseColor,
      roughness: placement.category === "Toiletries" ? 0.25 : 0.72,
      metalness: placement.category === "Toiletries" ? 0.15 : 0.0,
      clearcoat: placement.category === "Toiletries" ? 0.5 : 0,
      emissive: emissiveHex,
      emissiveIntensity: emissiveInt,
    });
    const capMat = new THREE.MeshStandardMaterial({
      color: placement.category === "Toiletries" ? 0xece3d7 : 0xf6f0e7,
      roughness: 0.3,
      metalness: placement.category === "Toiletries" ? 0.75 : 0.05,
      emissive: emissiveHex,
      emissiveIntensity: emissiveInt,
    });

    const cylGeo = new THREE.CylinderGeometry(radius, radius, length * 0.84, 24);
    const capGeo = new THREE.CylinderGeometry(radius * 0.82, radius * 0.86, length * 0.14, 24);

    if (dims[2].axis === "x") {
      cylGeo.rotateZ(Math.PI / 2);
      capGeo.rotateZ(Math.PI / 2);
    } else if (dims[2].axis === "z") {
      cylGeo.rotateX(Math.PI / 2);
      capGeo.rotateX(Math.PI / 2);
    }

    const cyl = new THREE.Mesh(cylGeo, bodyMat);
    cyl.castShadow = true;
    cyl.receiveShadow = true;
    const cap = new THREE.Mesh(capGeo, capMat);
    if (dims[2].axis === "x") cap.position.x = length * 0.44;
    else if (dims[2].axis === "y") cap.position.y = length * 0.44;
    else cap.position.z = length * 0.44;

    group.add(cyl, cap);
  } else if (placement.category === "Electronic Devices") {
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x3b2116,
      roughness: 0.28,
      metalness: 0.78,
      emissive: emissiveHex,
      emissiveIntensity: emissiveInt,
    });
    const screenMat = new THREE.MeshStandardMaterial({
      color: 0x1a120d,
      roughness: 0.15,
      metalness: 0.35,
    });

    const chassis = new THREE.Mesh(
      new THREE.BoxGeometry(sx * 0.96, sy * 0.92, sz * 0.96),
      metalMat
    );
    chassis.castShadow = true;
    chassis.receiveShadow = true;

    const inlay = new THREE.Mesh(
      new THREE.BoxGeometry(sx * 0.86, sy * 0.96, sz * 0.84),
      screenMat
    );
    group.add(chassis, inlay);
  } else {
    const fabricTex = createFabricTexture(placement.colorHex, maxAniso);
    const fabricMat = new THREE.MeshStandardMaterial({
      map: fabricTex,
      roughness: 0.78,
      metalness: 0.04,
      emissive: emissiveHex,
      emissiveIntensity: emissiveInt,
    });

    const mainBlock = new THREE.Mesh(
      new THREE.BoxGeometry(sx * 0.96, sy * 0.94, sz * 0.96),
      fabricMat
    );
    mainBlock.castShadow = true;
    mainBlock.receiveShadow = true;
    group.add(mainBlock);

    if (placement.compressed) {
      const strapMat = new THREE.MeshStandardMaterial({
        color: 0xf2c94c,
        roughness: 0.4,
        metalness: 0.2,
      });
      const strap = new THREE.Mesh(
        new THREE.BoxGeometry(sx * 0.14, sy * 0.98, sz * 0.99),
        strapMat
      );
      group.add(strap);
    }
  }

  if (isSelected || isColliding) {
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(sx, sy, sz));
    const lineMat = new THREE.LineBasicMaterial({
      color: isColliding ? 0xef4444 : 0xd4612f,
    });
    const outline = new THREE.LineSegments(edges, lineMat);
    group.add(outline);
  }

  return group;
}

export default function VirtualPacking3D({
  suitcase,
  placements,
  selectedUnitKey,
  onSelectUnit,
  onMoveUnit,
  manualDragEnabled,
  explodeFactor,
  lidOpen,
  cameraPreset,
  onCollisionFeedback,
}: VirtualPacking3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [contextLost, setContextLost] = useState(false);

  const propsRef = useRef({
    suitcase,
    placements,
    selectedUnitKey,
    onSelectUnit,
    onMoveUnit,
    manualDragEnabled,
    explodeFactor,
    lidOpen,
    onCollisionFeedback,
  });
  propsRef.current = {
    suitcase,
    placements,
    selectedUnitKey,
    onSelectUnit,
    onMoveUnit,
    manualDragEnabled,
    explodeFactor,
    lidOpen,
    onCollisionFeedback,
  };

  const sceneApiRef = useRef<{
    rebuildSuitcase: () => void;
    rebuildItems: () => void;
    setCameraPreset: (preset: "iso" | "top" | "front" | "side") => void;
    requestRender: () => void;
  } | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const width = Math.max(280, container.clientWidth);
    const height = Math.max(300, container.clientHeight);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf3ece1);
    scene.fog = new THREE.Fog(0xf3ece1, 10, 26);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 60);
    camera.position.set(2.8, 2.7, 3.0);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => setContextLost(false);
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);
    renderer.domElement.addEventListener("webglcontextrestored", onContextRestored);

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    // Lighting
    const hemi = new THREE.HemisphereLight(0xfff5e8, 0xd8cbb8, 0.92);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff3e0, 1.4);
    keyLight.position.set(3.5, 6.5, 3.5);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -3.5;
    keyLight.shadow.camera.right = 3.5;
    keyLight.shadow.camera.top = 3.5;
    keyLight.shadow.camera.bottom = -3.5;
    keyLight.shadow.bias = -0.0004;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xa9c6e6, 0.6);
    rimLight.position.set(-4, 4, -4);
    scene.add(rimLight);

    // Studio floor
    const floorGeo = new THREE.CircleGeometry(7, 48);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xebe1d3,
      roughness: 0.92,
      metalness: 0.04,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const suitcaseGroup = new THREE.Group();
    const lidPivot = new THREE.Group();
    const itemsGroup = new THREE.Group();
    scene.add(suitcaseGroup);
    scene.add(itemsGroup);

    const liningTex = createLiningTexture(maxAniso);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.minDistance = 1.6;
    controls.maxDistance = 8.0;
    controls.maxPolarAngle = Math.PI / 2 - 0.03;
    controls.target.set(0, 0.35, 0);

    // Camera transition state
    let camTargetPos: THREE.Vector3 | null = null;
    let camTargetLook: THREE.Vector3 | null = null;
    let currentLidAngle = propsRef.current.lidOpen ? -Math.PI * 0.58 : 0;

    // Drag & Raycasting state
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hitPoint = new THREE.Vector3();
    let draggingUnitKey: string | null = null;
    let dragOffsetX = 0;
    let dragOffsetZ = 0;
    let collidingUnitKey: string | null = null;
    let itemMeshMap = new Map<string, THREE.Group>();

    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let disposed = false;
    let lastClockTime = performance.now();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== "function") {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function requestRender() {
      if (disposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        if (disposed) return;
        renderDirty = false;

        const now = performance.now();
        const delta = Math.min(0.1, (now - lastClockTime) / 1000);
        lastClockTime = now;

        let needsMoreFrames = false;

        // Smooth lid rotation
        const desiredLidAngle = propsRef.current.lidOpen ? -Math.PI * 0.58 : 0;
        if (Math.abs(currentLidAngle - desiredLidAngle) > 0.005) {
          currentLidAngle = THREE.MathUtils.damp(currentLidAngle, desiredLidAngle, 8, delta);
          lidPivot.rotation.x = currentLidAngle;
          needsMoreFrames = true;
        } else {
          lidPivot.rotation.x = desiredLidAngle;
        }

        // Smooth camera preset damping
        if (camTargetPos && camTargetLook) {
          camera.position.x = THREE.MathUtils.damp(camera.position.x, camTargetPos.x, 7, delta);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, camTargetPos.y, 7, delta);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, camTargetPos.z, 7, delta);
          controls.target.x = THREE.MathUtils.damp(controls.target.x, camTargetLook.x, 7, delta);
          controls.target.y = THREE.MathUtils.damp(controls.target.y, camTargetLook.y, 7, delta);
          controls.target.z = THREE.MathUtils.damp(controls.target.z, camTargetLook.z, 7, delta);

          if (camera.position.distanceTo(camTargetPos) < 0.02) {
            camTargetPos = null;
            camTargetLook = null;
          } else {
            needsMoreFrames = true;
          }
        }

        // Smooth item position & explode damping
        const lMath = calculateLuggageMath(propsRef.current.suitcase);
        const halfL = (lMath.internalL * SCALE) / 2;
        const halfW = (lMath.internalW * SCALE) / 2;
        const baseFloorY = propsRef.current.suitcase.wallThicknessCm * SCALE;
        const explode = propsRef.current.explodeFactor;

        for (const p of propsRef.current.placements) {
          const grp = itemMeshMap.get(p.unitKey);
          if (!grp) continue;
          const targetX = -halfL + (p.x + p.dimX / 2) * SCALE;
          const targetY =
            baseFloorY + (p.y + p.dimY / 2) * SCALE + explode * (p.y * SCALE * 1.45);
          const targetZ = -halfW + (p.z + p.dimZ / 2) * SCALE;

          const dist =
            Math.abs(grp.position.x - targetX) +
            Math.abs(grp.position.y - targetY) +
            Math.abs(grp.position.z - targetZ);

          if (dist > 0.002 && !isSoftwareGl) {
            grp.position.x = THREE.MathUtils.damp(grp.position.x, targetX, 14, delta);
            grp.position.y = THREE.MathUtils.damp(grp.position.y, targetY, 14, delta);
            grp.position.z = THREE.MathUtils.damp(grp.position.z, targetZ, 14, delta);
            needsMoreFrames = true;
          } else {
            grp.position.set(targetX, targetY, targetZ);
          }
        }

        controls.update();
        renderer.render(scene, camera);

        const done = () => {
          renderBusy = false;
          if (renderDirty || needsMoreFrames) requestRender();
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    function disposeGroupChildren(group: THREE.Group) {
      while (group.children.length > 0) {
        const child = group.children[0];
        group.remove(child);
        child.traverse((obj) => {
          if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
            obj.geometry?.dispose();
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m) => m.dispose());
            } else {
              obj.material?.dispose();
            }
          }
        });
      }
    }

    function rebuildSuitcase() {
      disposeGroupChildren(suitcaseGroup);

      const cfg = propsRef.current.suitcase;
      const lMath = calculateLuggageMath(cfg);

      const extL = cfg.lengthCm * SCALE;
      const extW = cfg.widthCm * SCALE;
      const extH = cfg.heightCm * SCALE;
      const intL = lMath.internalL * SCALE;
      const intW = lMath.internalW * SCALE;
      const intH = lMath.internalH * SCALE;
      const wall = cfg.wallThicknessCm * SCALE;

      const shellMat = new THREE.MeshPhysicalMaterial({
        color: cfg.type === "carry-on" ? 0x3b2116 : 0x5b4a3f,
        roughness: 0.36,
        metalness: 0.14,
        clearcoat: 0.4,
      });

      const liningMat = new THREE.MeshStandardMaterial({
        map: liningTex,
        roughness: 0.85,
        metalness: 0.02,
      });

      const rimMat = new THREE.MeshStandardMaterial({
        color: 0xe29f5f,
        roughness: 0.3,
        metalness: 0.72,
      });

      const darkTrimMat = new THREE.MeshStandardMaterial({
        color: 0x2a1a12,
        roughness: 0.6,
        metalness: 0.25,
      });

      const trayH = wall + intH;

      // Bottom floor plate
      const bottomShell = new THREE.Mesh(
        new THREE.BoxGeometry(extL, wall, extW),
        shellMat
      );
      bottomShell.position.y = wall / 2;
      bottomShell.castShadow = true;
      bottomShell.receiveShadow = true;
      suitcaseGroup.add(bottomShell);

      // Interior quilted lining floor
      const innerFloor = new THREE.Mesh(
        new THREE.BoxGeometry(intL, 0.006, intW),
        liningMat
      );
      innerFloor.position.y = wall + 0.003;
      innerFloor.receiveShadow = true;
      suitcaseGroup.add(innerFloor);

      // 4 Tray Side Walls (Front, Back, Left, Right)
      const frontWall = new THREE.Mesh(
        new THREE.BoxGeometry(extL, trayH, wall),
        shellMat
      );
      frontWall.position.set(0, trayH / 2, extW / 2 - wall / 2);
      frontWall.castShadow = true;
      frontWall.receiveShadow = true;

      const backWall = new THREE.Mesh(
        new THREE.BoxGeometry(extL, trayH, wall),
        shellMat
      );
      backWall.position.set(0, trayH / 2, -extW / 2 + wall / 2);
      backWall.castShadow = true;
      backWall.receiveShadow = true;

      const leftWall = new THREE.Mesh(
        new THREE.BoxGeometry(wall, trayH, intW),
        shellMat
      );
      leftWall.position.set(-extL / 2 + wall / 2, trayH / 2, 0);
      leftWall.castShadow = true;
      leftWall.receiveShadow = true;

      const rightWall = new THREE.Mesh(
        new THREE.BoxGeometry(wall, trayH, intW),
        shellMat
      );
      rightWall.position.set(extL / 2 - wall / 2, trayH / 2, 0);
      rightWall.castShadow = true;
      rightWall.receiveShadow = true;

      suitcaseGroup.add(frontWall, backWall, leftWall, rightWall);

      // Turquoise anodized aluminum rim around open cavity
      const rimFront = new THREE.Mesh(
        new THREE.BoxGeometry(extL + 0.01, 0.02, 0.02),
        rimMat
      );
      rimFront.position.set(0, trayH + 0.008, extW / 2 - wall / 2);
      const rimBack = rimFront.clone();
      rimBack.position.z = -extW / 2 + wall / 2;
      const rimLeft = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 0.02, extW + 0.01),
        rimMat
      );
      rimLeft.position.set(-extL / 2 + wall / 2, trayH + 0.008, 0);
      const rimRight = rimLeft.clone();
      rimRight.position.x = extL / 2 - wall / 2;
      suitcaseGroup.add(rimFront, rimBack, rimLeft, rimRight);

      // Side spinner wheels (positioned on left X side as if lying flat)
      const wheelGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.05, 14);
      wheelGeo.rotateZ(Math.PI / 2);
      for (const zSign of [-1, 1]) {
        for (const yOff of [0.055, trayH * 0.78]) {
          const wMesh = new THREE.Mesh(wheelGeo, darkTrimMat);
          wMesh.position.set(-extL / 2 - 0.03, yOff, zSign * (extW * 0.34));
          suitcaseGroup.add(wMesh);
        }
      }

      // Internal Usable Boundary Wireframe (shows exact mathematical packing cavity)
      const usableWire = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(intL, intH, intW)),
        new THREE.LineBasicMaterial({
          color: 0xd4612f,
          transparent: true,
          opacity: 0.52,
        })
      );
      usableWire.position.y = wall + intH / 2;
      suitcaseGroup.add(usableWire);

      // Hinged Top Lid Group (pivoted at back edge)
      disposeGroupChildren(lidPivot);
      lidPivot.position.set(0, trayH, -extW / 2);
      lidPivot.rotation.x = currentLidAngle;

      const lidDepth = Math.max(0.08, extH * 0.16);
      const lidPanel = new THREE.Mesh(
        new THREE.BoxGeometry(extL, lidDepth, extW),
        new THREE.MeshPhysicalMaterial({
          color: cfg.type === "carry-on" ? 0x3b2116 : 0x5b4a3f,
          roughness: 0.38,
          metalness: 0.14,
          transparent: true,
          opacity: 0.82,
        })
      );
      lidPanel.position.set(0, lidDepth / 2, extW / 2);
      lidPivot.add(lidPanel);

      const lidMeshPocket = new THREE.Mesh(
        new THREE.BoxGeometry(intL * 0.9, 0.01, intW * 0.85),
        liningMat
      );
      lidMeshPocket.position.set(0, 0.006, extW / 2);
      lidPivot.add(lidMeshPocket);

      suitcaseGroup.add(lidPivot);
      requestRender();
    }

    function rebuildItems() {
      disposeGroupChildren(itemsGroup);
      itemMeshMap.clear();

      const cfg = propsRef.current.suitcase;
      const lMath = calculateLuggageMath(cfg);
      const halfL = (lMath.internalL * SCALE) / 2;
      const halfW = (lMath.internalW * SCALE) / 2;
      const baseFloorY = cfg.wallThicknessCm * SCALE;
      const explode = propsRef.current.explodeFactor;

      for (const p of propsRef.current.placements) {
        const isSelected = p.unitKey === propsRef.current.selectedUnitKey;
        const isColliding = p.unitKey === collidingUnitKey;
        const grp = buildItemMeshGroup(p, isSelected, isColliding, maxAniso);
        grp.userData.unitKey = p.unitKey;

        const targetX = -halfL + (p.x + p.dimX / 2) * SCALE;
        const targetY =
          baseFloorY + (p.y + p.dimY / 2) * SCALE + explode * (p.y * SCALE * 1.45);
        const targetZ = -halfW + (p.z + p.dimZ / 2) * SCALE;

        grp.position.set(targetX, targetY, targetZ);
        itemsGroup.add(grp);
        itemMeshMap.set(p.unitKey, grp);
      }

      requestRender();
    }

    function setCameraPreset(preset: "iso" | "top" | "front" | "side") {
      const cfg = propsRef.current.suitcase;
      const span = Math.max(cfg.lengthCm, cfg.widthCm) * SCALE;
      if (preset === "top") {
        camTargetPos = new THREE.Vector3(0.01, span * 1.75, 0.25);
        camTargetLook = new THREE.Vector3(0, 0.25, 0);
      } else if (preset === "front") {
        camTargetPos = new THREE.Vector3(0, span * 0.85, span * 1.65);
        camTargetLook = new THREE.Vector3(0, 0.35, 0);
      } else if (preset === "side") {
        camTargetPos = new THREE.Vector3(span * 1.65, span * 0.9, 0.1);
        camTargetLook = new THREE.Vector3(0, 0.35, 0);
      } else {
        camTargetPos = new THREE.Vector3(span * 1.15, span * 1.1, span * 1.25);
        camTargetLook = new THREE.Vector3(0, 0.32, 0);
      }
      requestRender();
    }

    function updatePointerNdc(e: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function findUnitKeyFromHit(obj: THREE.Object3D | null): string | null {
      let cur: THREE.Object3D | null = obj;
      while (cur) {
        if (typeof cur.userData?.unitKey === "string") {
          return cur.userData.unitKey;
        }
        cur = cur.parent;
      }
      return null;
    }

    function onPointerDown(e: PointerEvent) {
      updatePointerNdc(e);
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(itemsGroup.children, true);

      if (hits.length > 0) {
        const unitKey = findUnitKeyFromHit(hits[0].object);
        if (unitKey) {
          propsRef.current.onSelectUnit(unitKey);

          if (propsRef.current.manualDragEnabled) {
            const p = propsRef.current.placements.find((item) => item.unitKey === unitKey);
            if (p) {
              draggingUnitKey = unitKey;
              controls.enabled = false;

              const cfg = propsRef.current.suitcase;
              const lMath = calculateLuggageMath(cfg);
              const halfL = (lMath.internalL * SCALE) / 2;
              const halfW = (lMath.internalW * SCALE) / 2;
              const baseFloorY = cfg.wallThicknessCm * SCALE;
              const planeY = baseFloorY + (p.y + p.dimY / 2) * SCALE;
              dragPlane.set(new THREE.Vector3(0, 1, 0), -planeY);

              if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
                const curWorldX = -halfL + (p.x + p.dimX / 2) * SCALE;
                const curWorldZ = -halfW + (p.z + p.dimZ / 2) * SCALE;
                dragOffsetX = curWorldX - hitPoint.x;
                dragOffsetZ = curWorldZ - hitPoint.z;
              } else {
                dragOffsetX = 0;
                dragOffsetZ = 0;
              }
              renderer.domElement.style.cursor = "grabbing";
            }
          }
          return;
        }
      }

      if (!draggingUnitKey) {
        // Clicked empty space: deselect only if not orbiting? Wait — let user click floor to deselect
        // Wait: distinguish drag-orbit vs tap; handle click cleanly
      }
    }

    let lastMoveCheck = 0;
    function onPointerMove(e: PointerEvent) {
      if (!draggingUnitKey) return;
      const now = performance.now();
      if (now - lastMoveCheck < 16) return;
      lastMoveCheck = now;

      updatePointerNdc(e);
      raycaster.setFromCamera(pointerNdc, camera);
      if (!raycaster.ray.intersectPlane(dragPlane, hitPoint)) return;

      const idx = propsRef.current.placements.findIndex(
        (item) => item.unitKey === draggingUnitKey
      );
      if (idx === -1) return;

      const current = propsRef.current.placements[idx];
      const cfg = propsRef.current.suitcase;
      const lMath = calculateLuggageMath(cfg);
      const halfL = (lMath.internalL * SCALE) / 2;
      const halfW = (lMath.internalW * SCALE) / 2;

      const worldX = hitPoint.x + dragOffsetX;
      const worldZ = hitPoint.z + dragOffsetZ;

      const rawCmX = (worldX + halfL) / SCALE - current.dimX / 2;
      const rawCmZ = (worldZ + halfW) / SCALE - current.dimZ / 2;

      // Snap to 0.5 cm grid & clamp to suitcase interior
      const snappedX = round1(
        Math.max(0, Math.min(lMath.internalL - current.dimX, Math.round(rawCmX * 2) / 2))
      );
      const snappedZ = round1(
        Math.max(0, Math.min(lMath.internalW - current.dimZ, Math.round(rawCmZ * 2) / 2))
      );

      const candidate = {
        x: snappedX,
        y: current.y,
        z: snappedZ,
        dimX: current.dimX,
        dimY: current.dimY,
        dimZ: current.dimZ,
      };

      const valid = canPlaceBox(
        candidate,
        propsRef.current.placements,
        lMath.internalL,
        lMath.internalH,
        lMath.internalW,
        idx
      );

      if (valid) {
        collidingUnitKey = null;
        propsRef.current.onCollisionFeedback?.(null);
        propsRef.current.onMoveUnit(current.unitKey, snappedX, current.y, snappedZ);
      } else {
        collidingUnitKey = current.unitKey;
        propsRef.current.onCollisionFeedback?.(
          "Blocked: Objects cannot overlap or extend outside suitcase boundaries."
        );
        rebuildItems();
      }
    }

    function onPointerUp() {
      if (draggingUnitKey) {
        draggingUnitKey = null;
        collidingUnitKey = null;
        controls.enabled = true;
        renderer.domElement.style.cursor = "grab";
        propsRef.current.onCollisionFeedback?.(null);
        rebuildItems();
      }
    }

    const onControlStart = () => {
      camTargetPos = null;
      camTargetLook = null;
    };

    controls.addEventListener("change", requestRender);
    controls.addEventListener("start", onControlStart);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    const resizeObserver = new ResizeObserver(() => {
      if (!container || disposed) return;
      const nw = Math.max(280, container.clientWidth);
      const nh = Math.max(300, container.clientHeight);
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
      requestRender();
    });
    resizeObserver.observe(container);

    rebuildSuitcase();
    rebuildItems();
    if (!isSoftwareGl) renderer.compile(scene, camera);
    requestRender();

    sceneApiRef.current = {
      rebuildSuitcase,
      rebuildItems,
      setCameraPreset,
      requestRender,
    };

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.removeEventListener("change", requestRender);
      controls.removeEventListener("start", onControlStart);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored);
      controls.dispose();
      disposeGroupChildren(suitcaseGroup);
      disposeGroupChildren(itemsGroup);
      floorGeo.dispose();
      floorMat.dispose();
      liningTex.dispose();
      envTex.dispose();
      renderer.dispose();
      sceneApiRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneApiRef.current?.rebuildSuitcase();
  }, [suitcase]);

  useEffect(() => {
    sceneApiRef.current?.rebuildItems();
  }, [placements, selectedUnitKey, explodeFactor]);

  useEffect(() => {
    sceneApiRef.current?.requestRender();
  }, [lidOpen]);

  useEffect(() => {
    sceneApiRef.current?.setCameraPreset(cameraPreset);
  }, [cameraPreset]);

  if (contextLost) {
    return (
      <div className="flex h-full min-h-[340px] flex-col items-center justify-center rounded-[24px] bg-[#ece3d7] p-6 text-center">
        <p className="text-base font-medium text-[#2a1a12]">
          3D Virtual Packing Paused
        </p>
        <p className="mt-1 text-xs text-[#5b4a3f]">
          Your AutoPack coordinates and mathematical calculations remain active.
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full min-h-[340px] overflow-hidden rounded-[24px] bg-[#f3ece1]">
      <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing touch-none" />
    </div>
  );
}
