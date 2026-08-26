"use client";

import { Droplets, Flame } from "lucide-react";
import { useEffect, useRef, type CSSProperties } from "react";
import type { Group, MeshStandardMaterial } from "three";

import { formatMoney, pressureLabel } from "@/lib/format";

type FallingToken = {
  group: Group;
  material: MeshStandardMaterial;
  speed: number;
  drift: number;
  spin: number;
};

export function FloodTank({
  spend,
  level = 76,
}: {
  spend: number;
  level?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasVerifiedSpend = spend > 0;

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    let disposed = false;
    let animationFrame = 0;
    let cleanScene = () => undefined;

    async function startScene() {
      if (!host || !canvas) return;
      if (!hasVerifiedSpend) {
        host.dataset.webgl = "fallback";
        return;
      }
      const contextOptions = {
        alpha: true,
        antialias: true,
        powerPreference: "high-performance" as const,
      };
      const context = (canvas.getContext("webgl2", contextOptions)
        ?? canvas.getContext("webgl", contextOptions)) as WebGLRenderingContext | null;
      if (!context) {
        host.dataset.webgl = "fallback";
        return;
      }

      const THREE = await import("three");
      if (disposed || !host || !canvas) return;

      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({
          canvas,
          context,
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
        });
      } catch {
        host.dataset.webgl = "fallback";
        return;
      }
      delete host.dataset.webgl;

      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.25;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
      camera.position.set(0, 0.28, 8.45);
      camera.lookAt(0, -0.08, 0);

      const reactor = new THREE.Group();
      reactor.position.y = -0.13;
      reactor.rotation.set(-0.05, -0.16, -0.025);
      scene.add(reactor);

      scene.add(new THREE.HemisphereLight(0xbcefff, 0x062337, 2.1));
      const keyLight = new THREE.DirectionalLight(0xe7fbff, 3.1);
      keyLight.position.set(-4, 6, 7);
      scene.add(keyLight);
      const burnLight = new THREE.PointLight(0xff694f, hasVerifiedSpend ? 12 : 1.2, 6, 2);
      burnLight.position.set(0, -1.48, 1.2);
      scene.add(burnLight);
      const waterLight = new THREE.PointLight(0x29dbff, 9, 7, 2);
      waterLight.position.set(1.6, 0.6, 2.4);
      scene.add(waterLight);

      const chamberRadius = 2.12;
      const chamberBottom = -2.15;
      const chamberHeight = 4.3;
      const normalizedLevel = Math.min(100, Math.max(0, level));
      const targetWaterHeight = normalizedLevel === 0
        ? 0.08
        : 0.38 + (normalizedLevel / 100) * 3.45;

      const glassMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x8feaff,
        transparent: true,
        opacity: 0.12,
        roughness: 0.08,
        metalness: 0.08,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const glass = new THREE.Mesh(
        new THREE.CylinderGeometry(chamberRadius, chamberRadius, chamberHeight, 64, 1, true),
        glassMaterial,
      );
      reactor.add(glass);

      const frameMaterial = new THREE.MeshStandardMaterial({
        color: 0xa9efff,
        emissive: 0x116d86,
        emissiveIntensity: 1.2,
        metalness: 0.75,
        roughness: 0.22,
      });
      const ringGeometry = new THREE.TorusGeometry(chamberRadius, 0.055, 10, 80);
      for (const y of [-chamberHeight / 2, chamberHeight / 2]) {
        const ring = new THREE.Mesh(ringGeometry, frameMaterial);
        ring.position.y = y;
        ring.rotation.x = Math.PI / 2;
        reactor.add(ring);
      }
      const railGeometry = new THREE.CylinderGeometry(0.025, 0.025, chamberHeight, 8);
      for (const angle of [0.22, Math.PI - 0.22, Math.PI + 0.22, -0.22]) {
        const rail = new THREE.Mesh(railGeometry, frameMaterial);
        rail.position.set(
          Math.cos(angle) * chamberRadius,
          0,
          Math.sin(angle) * chamberRadius,
        );
        reactor.add(rail);
      }

      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(2.35, 2.48, 0.18, 64),
        new THREE.MeshStandardMaterial({
          color: 0x082331,
          metalness: 0.82,
          roughness: 0.28,
        }),
      );
      base.position.y = chamberBottom - 0.12;
      reactor.add(base);

      const waterMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x16bde8,
        emissive: 0x063f62,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.43,
        roughness: 0.08,
        metalness: 0.05,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const water = new THREE.Mesh(
        new THREE.CylinderGeometry(chamberRadius - 0.07, chamberRadius - 0.07, 1, 64, 1, true),
        waterMaterial,
      );
      water.renderOrder = 2;
      reactor.add(water);

      const surfaceMaterial = new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        uniforms: { uTime: { value: 0 } },
        vertexShader: `
          uniform float uTime;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            vec3 p = position;
            p.z += sin(p.x * 3.8 + uTime * 1.7) * 0.055;
            p.z += cos(p.y * 4.6 - uTime * 1.25) * 0.035;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: `
          varying vec2 vUv;
          void main() {
            float edge = smoothstep(0.5, 0.18, distance(vUv, vec2(0.5)));
            vec3 cyan = mix(vec3(0.04, 0.55, 0.75), vec3(0.35, 0.94, 1.0), vUv.y);
            gl_FragColor = vec4(cyan, 0.48 + edge * 0.28);
          }
        `,
      });
      const surface = new THREE.Mesh(
        new THREE.CircleGeometry(chamberRadius - 0.055, 80),
        surfaceMaterial,
      );
      surface.rotation.x = -Math.PI / 2;
      surface.renderOrder = 3;
      reactor.add(surface);
      const surfaceRing = new THREE.Mesh(
        new THREE.TorusGeometry(chamberRadius - 0.04, 0.035, 8, 72),
        new THREE.MeshBasicMaterial({
          color: 0x7beaff,
          transparent: true,
          opacity: 0.88,
          depthTest: false,
        }),
      );
      surfaceRing.rotation.x = Math.PI / 2;
      surfaceRing.renderOrder = 4;
      reactor.add(surfaceRing);

      const core = new THREE.Group();
      core.position.y = -1.48;
      reactor.add(core);
      const coreShell = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.48, 1),
        new THREE.MeshStandardMaterial({
          color: hasVerifiedSpend ? 0xff6d52 : 0x527781,
          emissive: hasVerifiedSpend ? 0xff321c : 0x0b4557,
          emissiveIntensity: hasVerifiedSpend ? 3.4 : 0.45,
          wireframe: true,
          depthTest: false,
        }),
      );
      coreShell.renderOrder = 6;
      core.add(coreShell);
      const coreGlow = new THREE.Mesh(
        new THREE.SphereGeometry(0.34, 24, 16),
        new THREE.MeshBasicMaterial({
          color: hasVerifiedSpend ? 0xff8a58 : 0x47b8d1,
          transparent: true,
          opacity: hasVerifiedSpend ? 0.46 : 0.13,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          depthTest: false,
        }),
      );
      coreGlow.renderOrder = 5;
      core.add(coreGlow);
      const coreOrbit = new THREE.Mesh(
        new THREE.TorusGeometry(0.73, 0.025, 8, 48),
        new THREE.MeshBasicMaterial({ color: hasVerifiedSpend ? 0xbdff5b : 0x356879 }),
      );
      coreOrbit.rotation.x = Math.PI / 2.7;
      core.add(coreOrbit);

      const coinGeometry = new THREE.CylinderGeometry(0.33, 0.33, 0.1, 28);
      const coinRingGeometry = new THREE.TorusGeometry(0.245, 0.029, 7, 28);
      const chipGeometry = new THREE.BoxGeometry(0.17, 0.17, 0.06);
      const coinFaceMaterial = new THREE.MeshBasicMaterial({ color: 0xffe0a6, depthTest: false });
      const chipMaterial = new THREE.MeshBasicMaterial({ color: 0x102a38, depthTest: false });
      const tokenStates: FallingToken[] = [];
      const tokenRespawnY = chamberHeight / 2 + 0.18;
      const tokenRespawnJitter = 0.18;

      const tokenCount = hasVerifiedSpend ? 7 : 0;
      for (let index = 0; index < tokenCount; index += 1) {
        const group = new THREE.Group();
        const material = new THREE.MeshStandardMaterial({
          color: index % 3 === 0 ? 0xbdff5b : 0xff7b63,
          emissive: index % 3 === 0 ? 0x4a8c16 : 0xd6331f,
          emissiveIntensity: 2.2,
          metalness: 0.5,
          roughness: 0.25,
          transparent: true,
          opacity: 0.95,
          depthTest: false,
        });
        const coin = new THREE.Mesh(coinGeometry, material);
        coin.rotation.x = Math.PI / 2;
        coin.renderOrder = 5;
        group.add(coin);
        const face = new THREE.Mesh(coinRingGeometry, coinFaceMaterial);
        face.position.z = 0.052;
        face.renderOrder = 6;
        group.add(face);
        const chip = new THREE.Mesh(chipGeometry, chipMaterial);
        chip.position.z = 0.058;
        chip.renderOrder = 6;
        group.add(chip);

        group.position.set(
          (Math.random() - 0.5) * 2.7,
          -1.05 + (index / 10) * 3.5 + Math.random() * 0.22,
          (Math.random() - 0.5) * 1.25,
        );
        group.rotation.set(Math.random(), Math.random(), Math.random());
        reactor.add(group);
        tokenStates.push({
          group,
          material,
          speed: 0.38 + Math.random() * 0.3,
          drift: Math.random() * Math.PI * 2,
          spin: 0.8 + Math.random() * 1.1,
        });
      }

      const bubbleGeometry = new THREE.SphereGeometry(0.045, 10, 8);
      const bubbleMaterial = new THREE.MeshBasicMaterial({
        color: 0xc7f7ff,
        transparent: true,
        opacity: 0.68,
        wireframe: true,
      });
      const bubbles = Array.from({ length: 10 }, () => {
        const mesh = new THREE.Mesh(bubbleGeometry, bubbleMaterial);
        const scale = 0.55 + Math.random() * 1.8;
        mesh.scale.setScalar(scale);
        mesh.position.set(
          (Math.random() - 0.5) * 3.15,
          chamberBottom + Math.random() * targetWaterHeight,
          (Math.random() - 0.5) * 1.2,
        );
        reactor.add(mesh);
        return { mesh, speed: 0.24 + Math.random() * 0.38, phase: Math.random() * 9 };
      });

      const sparkCount = hasVerifiedSpend ? 30 : 0;
      const sparkPositions = new Float32Array(sparkCount * 3);
      const sparkSpeeds = new Float32Array(sparkCount);
      function resetSpark(index: number, randomHeight = false) {
        const offset = index * 3;
        sparkPositions[offset] = (Math.random() - 0.5) * 0.86;
        sparkPositions[offset + 1] = -1.48 + (randomHeight ? Math.random() * 1.7 : 0);
        sparkPositions[offset + 2] = (Math.random() - 0.5) * 0.7;
        sparkSpeeds[index] = 0.38 + Math.random() * 0.7;
      }
      for (let index = 0; index < sparkCount; index += 1) resetSpark(index, true);
      const sparkGeometry = new THREE.BufferGeometry();
      const sparkAttribute = new THREE.BufferAttribute(sparkPositions, 3);
      sparkGeometry.setAttribute("position", sparkAttribute);
      const sparks = new THREE.Points(
        sparkGeometry,
        new THREE.PointsMaterial({
          color: 0xff6a45,
          size: 0.055,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          depthTest: false,
        }),
      );
      sparks.renderOrder = 6;
      reactor.add(sparks);

      let pointerX = 0;
      let pointerY = 0;
      const onPointerMove = (event: PointerEvent) => {
        const bounds = host.getBoundingClientRect();
        pointerX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 0.22;
        pointerY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 0.12;
      };
      const onPointerLeave = () => {
        pointerX = 0;
        pointerY = 0;
      };
      host.addEventListener("pointermove", onPointerMove);
      host.addEventListener("pointerleave", onPointerLeave);

      const resize = () => {
        const width = Math.max(1, host.clientWidth);
        const height = Math.max(1, host.clientHeight);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
      resize();

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const startedAt = performance.now();
      let previousFrame = startedAt;
      let waterHeight = reducedMotion ? targetWaterHeight : 0.08;

      const render = (time = performance.now()) => {
        const delta = Math.min((time - previousFrame) / 1000, 0.04);
        const elapsed = (time - startedAt) / 1000;
        previousFrame = time;
        waterHeight += (targetWaterHeight - waterHeight) * (reducedMotion ? 1 : 0.028);
        const surfaceY = chamberBottom + waterHeight;

        water.scale.y = Math.max(0.02, waterHeight);
        water.position.y = chamberBottom + waterHeight / 2;
        surface.position.y = surfaceY;
        surfaceRing.position.y = surfaceY;
        surfaceMaterial.uniforms.uTime.value = elapsed;

        reactor.rotation.y += ((-0.16 + pointerX) - reactor.rotation.y) * 0.035;
        reactor.rotation.x += ((-0.05 + pointerY) - reactor.rotation.x) * 0.035;
        core.rotation.x = elapsed * 0.7;
        core.rotation.y = elapsed * 1.05;
        coreOrbit.rotation.z = elapsed * 1.4;
        const corePulse = 1 + Math.sin(elapsed * 4.2) * 0.07;
        coreGlow.scale.setScalar(corePulse);

        for (const token of tokenStates) {
          token.group.position.y -= token.speed * delta;
          token.group.position.x += Math.sin(elapsed * 1.3 + token.drift) * delta * 0.08;
          token.group.rotation.x += token.spin * delta;
          token.group.rotation.y += token.spin * 0.7 * delta;
          token.material.opacity = token.group.position.y < surfaceY ? 0.58 : 0.95;
          const distanceToCore = Math.max(0, token.group.position.y + 1.48);
          token.group.scale.setScalar(Math.min(1, 0.46 + distanceToCore));
          if (token.group.position.y < -1.52) {
            token.group.position.set(
              (Math.random() - 0.5) * 2.7,
              tokenRespawnY + Math.random() * tokenRespawnJitter,
              (Math.random() - 0.5) * 1.25,
            );
            token.group.scale.setScalar(1);
          }
        }

        for (const bubble of bubbles) {
          bubble.mesh.position.y += bubble.speed * delta;
          bubble.mesh.position.x += Math.sin(elapsed * 1.8 + bubble.phase) * delta * 0.04;
          bubble.mesh.visible = bubble.mesh.position.y < surfaceY;
          if (bubble.mesh.position.y > surfaceY) {
            bubble.mesh.position.y = chamberBottom + Math.random() * 0.18;
            bubble.mesh.position.x = (Math.random() - 0.5) * 3.15;
          }
        }

        for (let index = 0; index < sparkCount; index += 1) {
          const offset = index * 3;
          sparkPositions[offset + 1] += sparkSpeeds[index] * delta;
          sparkPositions[offset] += Math.sin(elapsed * 3 + index) * delta * 0.018;
          if (sparkPositions[offset + 1] > -0.05) resetSpark(index);
        }
        sparkAttribute.needsUpdate = true;

        renderer.render(scene, camera);
        if (!reducedMotion) animationFrame = window.requestAnimationFrame(render);
      };
      render();

      cleanScene = () => {
        window.cancelAnimationFrame(animationFrame);
        resizeObserver.disconnect();
        host.removeEventListener("pointermove", onPointerMove);
        host.removeEventListener("pointerleave", onPointerLeave);
        scene.traverse((object) => {
          if (!(object instanceof THREE.Mesh || object instanceof THREE.Points)) return;
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) material.dispose();
        });
        renderer.dispose();
      };
    }

    void startScene();
    return () => {
      disposed = true;
      cleanScene();
    };
  }, [hasVerifiedSpend, level]);

  return (
    <div
      ref={hostRef}
      className={`token-reactor ${hasVerifiedSpend ? "" : "is-idle"}`}
      style={{ "--reactor-level": `${level}%` } as CSSProperties}
      aria-label={`${formatMoney(spend)} in AI spend; ${pressureLabel(level)} at ${level}% flood level`}
    >
      <canvas ref={canvasRef} className="token-reactor-canvas" aria-hidden="true" />
      <div className="reactor-burn-readout">
        <span><Flame size={13} /> AI TOKENS BURNED</span>
        <strong>{formatMoney(spend, true)}</strong>
        <small>LABELED · LAST 90 DAYS</small>
      </div>
      <div className="reactor-flood-readout">
        <span><Droplets size={13} /> FLOOD LEVEL</span>
        <strong>{level}%</strong>
      </div>
      {!hasVerifiedSpend ? (
        <div className="reactor-idle" aria-hidden="true">
          <span>TANK EMPTY</span>
          <strong>First founder starts the burn.</strong>
        </div>
      ) : null}
      <div className="reactor-legend" aria-hidden="true">
        <span><i className="is-hot" /> TOKENS DROP</span>
        <b>→ BURN →</b>
        <span><i className="is-water" /> WATER RISES</span>
      </div>
      <span className="reactor-fallback" aria-hidden="true" />
    </div>
  );
}
