import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { SuitcaseConfig } from "../types";

interface LuggageDimension3DProps {
  suitcase: SuitcaseConfig;
}

const SCALE = 0.04; // 1 cm = 0.04 world units (55 cm -> 2.2 units)

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

export default function LuggageDimension3D({ suitcase }: LuggageDimension3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [contextLost, setContextLost] = useState(false);

  const sceneRef = useRef<{
    suitcaseGroup: THREE.Group;
    requestRender: () => void;
    buildModel: (cfg: SuitcaseConfig) => void;
  } | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const width = Math.max(240, container.clientWidth);
    const height = Math.max(240, container.clientHeight);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf3ece1);
    scene.fog = new THREE.Fog(0xf3ece1, 8, 22);

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 50);
    camera.position.set(3.1, 2.5, 3.6);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener("webglcontextlost", handleContextLost);
    renderer.domElement.addEventListener("webglcontextrestored", handleContextRestored);

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    // 3-Point Studio Lighting
    const hemi = new THREE.HemisphereLight(0xfff5e8, 0xd8cbb8, 0.9);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff3e0, 1.45);
    keyLight.position.set(4, 6, 4);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -3;
    keyLight.shadow.camera.right = 3;
    keyLight.shadow.camera.top = 3;
    keyLight.shadow.camera.bottom = -3;
    keyLight.shadow.bias = -0.0004;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xa9c6e6, 0.7);
    rimLight.position.set(-4, 3, -3);
    scene.add(rimLight);

    // Subtle Studio Floor & Radial Contact Shadow
    const floorGeo = new THREE.CircleGeometry(6, 48);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xebe1d3,
      roughness: 0.9,
      metalness: 0.04,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(6, 24, 0xb8a695, 0xd8cbb8);
    grid.position.y = 0.003;
    (grid.material as THREE.Material).opacity = 0.4;
    (grid.material as THREE.Material).transparent = true;
    scene.add(grid);

    const suitcaseGroup = new THREE.Group();
    scene.add(suitcaseGroup);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.minDistance = 2.0;
    controls.maxDistance = 8.5;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.target.set(0, 1.0, 0);

    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let disposed = false;

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
        controls.update();
        renderer.render(scene, camera);
        const done = () => {
          renderBusy = false;
          if (renderDirty && !disposed) requestRender();
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    function disposeGroup(group: THREE.Group) {
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

    function buildModel(cfg: SuitcaseConfig) {
      disposeGroup(suitcaseGroup);

      // Standing orientation: Y = lengthCm (tall), X = widthCm, Z = heightCm (depth)
      const h = Math.max(0.4, cfg.lengthCm * SCALE);
      const w = Math.max(0.3, cfg.widthCm * SCALE);
      const d = Math.max(0.2, cfg.heightCm * SCALE);
      const wheelH = 0.14;
      const bodyH = Math.max(0.35, h - wheelH);

      const shellMat = new THREE.MeshPhysicalMaterial({
        color: cfg.type === "carry-on" ? 0x3b2116 : 0x5b4a3f,
        roughness: 0.34,
        metalness: 0.15,
        clearcoat: 0.45,
        clearcoatRoughness: 0.25,
      });

      const accentMat = new THREE.MeshStandardMaterial({
        color: 0xe29f5f,
        roughness: 0.28,
        metalness: 0.72,
      });

      const darkTrimMat = new THREE.MeshStandardMaterial({
        color: 0x2a1a12,
        roughness: 0.65,
        metalness: 0.25,
      });

      const chromeMat = new THREE.MeshStandardMaterial({
        color: 0xf6ede2,
        roughness: 0.22,
        metalness: 0.85,
      });

      // 1. Primary Polycarbonate Shell
      const bodyGeo = new THREE.BoxGeometry(w, bodyH, d);
      const bodyMesh = new THREE.Mesh(bodyGeo, shellMat);
      bodyMesh.position.y = wheelH + bodyH / 2;
      bodyMesh.castShadow = true;
      bodyMesh.receiveShadow = true;
      suitcaseGroup.add(bodyMesh);

      // 2. Center Zipper / Aluminum Frame Seam
      const seamGeo = new THREE.BoxGeometry(w + 0.016, bodyH + 0.012, 0.032);
      const seamMesh = new THREE.Mesh(seamGeo, darkTrimMat);
      seamMesh.position.y = wheelH + bodyH / 2;
      suitcaseGroup.add(seamMesh);

      // 3. Horizontal Rib Ridges
      const ribCount = 4;
      for (let i = 1; i <= ribCount; i++) {
        const yPos = wheelH + (bodyH * i) / (ribCount + 1);
        const ribGeo = new THREE.BoxGeometry(w * 0.86, 0.022, d + 0.018);
        const rib = new THREE.Mesh(ribGeo, shellMat);
        rib.position.y = yPos;
        suitcaseGroup.add(rib);
      }

      // 4. Brushed Champagne Gold Corner Guards
      const guardSize = Math.min(w, d) * 0.18;
      const guardGeo = new THREE.BoxGeometry(guardSize, guardSize, guardSize);
      const corners = [
        [-w / 2 + guardSize * 0.42, wheelH + bodyH - guardSize * 0.42, -d / 2 + guardSize * 0.42],
        [w / 2 - guardSize * 0.42, wheelH + bodyH - guardSize * 0.42, -d / 2 + guardSize * 0.42],
        [-w / 2 + guardSize * 0.42, wheelH + bodyH - guardSize * 0.42, d / 2 - guardSize * 0.42],
        [w / 2 - guardSize * 0.42, wheelH + bodyH - guardSize * 0.42, d / 2 - guardSize * 0.42],
      ];
      for (const [cx, cy, cz] of corners) {
        const guard = new THREE.Mesh(guardGeo, accentMat);
        guard.position.set(cx, cy, cz);
        suitcaseGroup.add(guard);
      }

      // 5. Four Double-Spinner Wheels
      const wheelGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.06, 16);
      wheelGeo.rotateZ(Math.PI / 2);
      const wheelOffsets = [
        [-w * 0.36, 0.055, -d * 0.34],
        [w * 0.36, 0.055, -d * 0.34],
        [-w * 0.36, 0.055, d * 0.34],
        [w * 0.36, 0.055, d * 0.34],
      ];
      for (const [wx, wy, wz] of wheelOffsets) {
        const wheel = new THREE.Mesh(wheelGeo, darkTrimMat);
        wheel.position.set(wx, wy, wz);
        wheel.castShadow = true;
        suitcaseGroup.add(wheel);
      }

      // 6. Telescoping Handle Poles + Top Grip
      const poleGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.55, 12);
      const poleL = new THREE.Mesh(poleGeo, chromeMat);
      poleL.position.set(-w * 0.22, wheelH + bodyH + 0.27, -d * 0.18);
      const poleR = new THREE.Mesh(poleGeo, chromeMat);
      poleR.position.set(w * 0.22, wheelH + bodyH + 0.27, -d * 0.18);
      const gripGeo = new THREE.BoxGeometry(w * 0.52, 0.055, 0.065);
      const grip = new THREE.Mesh(gripGeo, darkTrimMat);
      grip.position.set(0, wheelH + bodyH + 0.55, -d * 0.18);
      suitcaseGroup.add(poleL, poleR, grip);

      // 7. Side Carry Handle
      const sideHandleGeo = new THREE.BoxGeometry(0.04, bodyH * 0.24, 0.06);
      const sideHandle = new THREE.Mesh(sideHandleGeo, darkTrimMat);
      sideHandle.position.set(w / 2 + 0.02, wheelH + bodyH * 0.52, 0);
      suitcaseGroup.add(sideHandle);

      // 8. Wireframe Dimension Bounding Cage (Warm Terracotta)
      const cageGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(w + 0.08, h + 0.02, d + 0.08));
      const cageMat = new THREE.LineBasicMaterial({
        color: 0xd4612f,
        transparent: true,
        opacity: 0.72,
      });
      const cage = new THREE.LineSegments(cageGeo, cageMat);
      cage.position.y = h / 2 + 0.01;
      suitcaseGroup.add(cage);

      controls.target.set(0, h * 0.52, 0);
      requestRender();
    }

    buildModel(suitcase);

    controls.addEventListener("change", requestRender);

    const resizeObserver = new ResizeObserver(() => {
      if (!container || disposed) return;
      const nw = Math.max(240, container.clientWidth);
      const nh = Math.max(240, container.clientHeight);
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
      requestRender();
    });
    resizeObserver.observe(container);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }
    requestRender();

    sceneRef.current = {
      suitcaseGroup,
      requestRender,
      buildModel,
    };

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.removeEventListener("change", requestRender);
      controls.dispose();
      renderer.domElement.removeEventListener("webglcontextlost", handleContextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", handleContextRestored);
      disposeGroup(suitcaseGroup);
      floorGeo.dispose();
      floorMat.dispose();
      envTex.dispose();
      renderer.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.buildModel(suitcase);
  }, [suitcase]);

  if (contextLost) {
    return (
      <div className="flex h-full min-h-[260px] flex-col items-center justify-center rounded-[24px] bg-[#ece3d7] p-6 text-center">
        <p className="text-sm font-medium text-[#2a1a12]">
          3D Preview Paused ({suitcase.lengthCm} × {suitcase.widthCm} × {suitcase.heightCm} cm)
        </p>
        <p className="mt-1 text-xs text-[#5b4a3f]">
          Graphics context paused. Dimensions remain active in calculations.
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full min-h-[260px] overflow-hidden rounded-[24px] bg-[#f3ece1]">
      <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" />
      <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-full bg-[#faf5ee]/95 px-4 py-2 text-xs text-[#2a1a12] shadow-sm border border-[#2a1a12]/10">
        <span className="font-mono tabular-nums font-medium">
          {suitcase.lengthCm} × {suitcase.widthCm} × {suitcase.heightCm} cm
        </span>
        <span className="text-[#5b4a3f]">Drag to rotate · Scroll to zoom</span>
      </div>
    </div>
  );
}
