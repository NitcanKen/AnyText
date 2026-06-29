/**
 * SendBeam — THE SEND, done right (SoT §5): the redemption of the thin line.
 *
 * Not a DOM gradient span. One continuous ~1s shot, GPU-side, driven by a SINGLE
 * GSAP timeline (the lesson from §0: the old four CSS animations were `setTimeout`-
 * chained with no shared clock, so they read as separate twitches). Here every beat
 * — charge, fire, travel, impact, condense — is one timeline tweening one plain
 * object; `useFrame` reads it and moves real geometry. One gesture, one clock.
 *
 * Anchor-bridged (SoT §3.1): at fire time it reads the *real* Send button rect and
 * the *real* queue rect from the Anchor registry and unprojects both onto a world
 * plane, so the beam genuinely fires from the button to the queue. The path bows in
 * to the RelayCore at its midpoint, so the document-chip ribbon streams *through the
 * core* (the reference's signature) on its way to the queue.
 *
 * It writes `sendPulse` every frame; PointerField (field displacement), RelayCore
 * (impact ripple + danger flash), CameraRig (kick) and PostFX (chromatic aberration)
 * all poll it — that is how one shot moves the whole world at once.
 *
 * Fail (`recoil`): the beam snaps back toward the button tinted danger and the core
 * flashes danger once. Content is never cleared here — that lives in the send handler.
 */

import { useFrame, useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { readAnchor } from '../anchors';
import { sendPulse, subscribeSend, useExperienceStore } from '../store';

// World plane (between camera and core) the DOM anchors project onto. The path
// dips back to the core's own depth at its midpoint so the ribbon crosses the core.
const ANCHOR_PLANE_Z = 1.2;
const CORE = new THREE.Vector3(0, 0.06, 0.18);
const ACCENT = new THREE.Color('#befc3c'); // lime = action / yours (color discipline)
const DANGER = new THREE.Color('#f87171'); // fail-recoil only
const CHIP_COUNT = 7;
const CONDENSE_COUNT = 44;

/** The single object the timeline tweens. `useFrame` reads it; nothing else writes it. */
interface Shot {
  charge: number; // packet forms at the button
  beam: number; // 0..1 fraction of the fire→impact leg
  ribbon: number; // 0..1 head of the document-chip stream along the full path
  impactV: number; // core-ripple impulse (spike → decay)
  ring: number; // shockwave ring expansion at the core (0→1 once)
  condense: number; // particle burst → new row at the queue (0→1 once)
  kickV: number; // camera-kick impulse
  caV: number; // chromatic-aberration launch envelope
  dangerV: number; // fail danger flash
  recoil: number; // 1→0 reverse streak on fail (head travels core→button)
}

function makeShot(): Shot {
  return {
    charge: 0,
    beam: 0,
    ribbon: 0,
    impactV: 0,
    ring: 0,
    condense: 0,
    kickV: 0,
    caV: 0,
    dangerV: 0,
    recoil: 0,
  };
}

/** Quadratic Bézier into `out`. */
function quad(
  out: THREE.Vector3,
  p0: THREE.Vector3,
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  t: number,
): THREE.Vector3 {
  const u = 1 - t;
  const a = u * u;
  const b = 2 * u * t;
  const c = t * t;
  out.set(
    a * p0.x + b * p1.x + c * p2.x,
    a * p0.y + b * p1.y + c * p2.y,
    a * p0.z + b * p1.z + c * p2.z,
  );
  return out;
}

/** Project a CSS-pixel screen point onto the world plane `planeZ`. */
function screenToWorld(
  cssX: number,
  cssY: number,
  camera: THREE.Camera,
  planeZ: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  const ndcX = (cssX / window.innerWidth) * 2 - 1;
  const ndcY = -((cssY / window.innerHeight) * 2 - 1);
  out.set(ndcX, ndcY, 0.5).unproject(camera);
  out.sub(camera.position);
  const t = (planeZ - camera.position.z) / (out.z || -1e-3);
  out.multiplyScalar(t).add(camera.position);
  return out;
}

export function SendBeam() {
  const camera = useThree((s) => s.camera);

  // QA aid (mirrors `?debugAnchor`): `?shotScale=8` slows the shot 8× so each beat
  // can be captured in a screenshot. Inert at its default of 1 — never affects users.
  const shotScale = useMemo(() => {
    if (typeof window === 'undefined') return 1;
    const v = Number(new URLSearchParams(window.location.search).get('shotScale'));
    return Number.isFinite(v) && v > 0 ? Math.min(v, 20) : 1;
  }, []);

  const shotRef = useRef<Shot>(makeShot());
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  // Path control points, captured at fire time (so the beam locks to where the
  // button actually was when clicked) and reused by an immediately-following recoil.
  const path = useRef({
    o: new THREE.Vector3(),
    q: new THREE.Vector3(),
    ctrlA: new THREE.Vector3(),
    ctrlB: new THREE.Vector3(),
    captured: false,
  });

  // Mesh refs.
  const groupRef = useRef<THREE.Group>(null);
  const chargeRef = useRef<THREE.Mesh>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const headRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const ribbonRef = useRef<THREE.InstancedMesh>(null);
  const condenseRef = useRef<THREE.Points>(null);

  // Reusable scratch.
  const scratch = useMemo(
    () => ({
      head: new THREE.Vector3(),
      tail: new THREE.Vector3(),
      mid: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
      quatA: new THREE.Quaternion(),
      dummy: new THREE.Object3D(),
    }),
    [],
  );

  // Geometry + materials (memoised; disposed on unmount).
  const gfx = useMemo(() => {
    // Tapered streak: full at the head (+Y), thin at the tail.
    const beamGeo = new THREE.CylinderGeometry(0.05, 0.008, 1, 9, 1, true);
    beamGeo.translate(0, 0.5, 0); // base at origin → scale.y stretches toward +Y
    const sphereGeo = new THREE.SphereGeometry(1, 18, 18);
    const ringGeo = new THREE.RingGeometry(0.46, 0.6, 56);
    const chipGeo = new THREE.PlaneGeometry(0.12, 0.16);

    const beamMat = new THREE.MeshBasicMaterial({
      color: ACCENT,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const headMat = new THREE.MeshBasicMaterial({
      color: ACCENT,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const chargeMat = new THREE.MeshBasicMaterial({
      color: ACCENT,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const ringMat = new THREE.MeshBasicMaterial({
      color: ACCENT,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const chipMat = new THREE.MeshBasicMaterial({
      color: ACCENT,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });

    // Condense burst — deterministic scatter that converges into the queue row.
    let seed = 0x5e2d;
    const rand = () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const offsets = new Float32Array(CONDENSE_COUNT * 3);
    for (let i = 0; i < CONDENSE_COUNT; i++) {
      const a = rand() * Math.PI * 2;
      const r = 0.18 + rand() * 0.5;
      offsets[i * 3] = Math.cos(a) * r;
      offsets[i * 3 + 1] = (rand() - 0.5) * 0.7;
      offsets[i * 3 + 2] = Math.sin(a) * r * 0.5;
    }
    const condenseGeo = new THREE.BufferGeometry();
    condenseGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(CONDENSE_COUNT * 3), 3),
    );
    const condenseMat = new THREE.PointsMaterial({
      color: ACCENT,
      size: 0.05,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });

    return {
      beamGeo,
      sphereGeo,
      ringGeo,
      chipGeo,
      condenseGeo,
      beamMat,
      headMat,
      chargeMat,
      ringMat,
      chipMat,
      condenseMat,
      offsets,
    };
  }, []);

  useEffect(() => {
    const g = gfx;
    return () => {
      g.beamGeo.dispose();
      g.sphereGeo.dispose();
      g.ringGeo.dispose();
      g.chipGeo.dispose();
      g.condenseGeo.dispose();
      g.beamMat.dispose();
      g.headMat.dispose();
      g.chargeMat.dispose();
      g.ringMat.dispose();
      g.chipMat.dispose();
      g.condenseMat.dispose();
    };
  }, [gfx]);

  // Capture the send→queue path from live DOM rects at fire/recoil time.
  const capturePath = () => {
    const send = readAnchor('send');
    const queue = readAnchor('queue');
    const p = path.current;
    if (send) {
      screenToWorld(send.cx, send.cy, camera, ANCHOR_PLANE_Z, p.o);
    } else {
      p.o.set(-1.1, -1.3, ANCHOR_PLANE_Z);
    }
    if (queue) {
      // Land near the TOP of the queue panel, where the new row condenses.
      screenToWorld(queue.cx, queue.cy - queue.height / 2 + 64, camera, ANCHOR_PLANE_Z, p.q);
    } else {
      p.q.set(2.4, 0.7, ANCHOR_PLANE_Z);
    }
    // Controls bow the legs up and toward the camera for a 3D arc; the shared CORE
    // waypoint pulls the full path through the core's depth.
    p.ctrlA.copy(p.o).add(CORE).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.42, 0.85));
    p.ctrlB.copy(CORE).add(p.q).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.5, 0.85));
    p.captured = true;
  };

  // Point along the FULL path o→CORE→q (s in 0..1); the ribbon rides this.
  const fullPath = (out: THREE.Vector3, s: number) => {
    const p = path.current;
    if (s < 0.5) return quad(out, p.o, p.ctrlA, CORE, s * 2);
    return quad(out, CORE, p.ctrlB, p.q, (s - 0.5) * 2);
  };
  // Point along leg A (o→CORE); the beam projectile rides this.
  const legA = (out: THREE.Vector3, t: number) => {
    const p = path.current;
    return quad(out, p.o, p.ctrlA, CORE, THREE.MathUtils.clamp(t, 0, 1));
  };

  useEffect(() => {
    const unsub = subscribeSend((event) => {
      const reduced = useExperienceStore.getState().reducedMotion;
      capturePath();
      tlRef.current?.kill();
      const shot = shotRef.current;

      if (event.status === 'recoil') {
        // Fail: danger flash + reverse streak back toward the button. Leave any
        // remaining fire artifacts to settle on their own.
        Object.assign(shot, { recoil: 1, dangerV: 0 });
        const tl = gsap.timeline();
        tl.to(shot, { dangerV: 1, duration: 0.08, ease: 'power3.out' }, 0)
          .to(shot, { dangerV: 0, duration: 0.5, ease: 'power2.out' }, 0.08)
          .to(shot, { recoil: 0, duration: reduced ? 0.2 : 0.36, ease: 'power2.in' }, 0)
          .call(
            () => {
              sendPulse.active = false;
              sendPulse.travel = 0;
            },
            undefined,
            reduced ? 0.2 : 0.36,
          );
        tl.timeScale(1 / shotScale);
        tlRef.current = tl;
        return;
      }

      // FIRE — one ~1s shot. Reset, then sequence the beats on one clock.
      Object.assign(shot, makeShot());
      const d = reduced ? 0.55 : 1; // compress (don't skip) under reduced motion
      const tl = gsap.timeline();

      // 1. Charge — content collapses into a bright packet at the button.
      tl.to(shot, { charge: 1, duration: 0.16 * d, ease: 'power2.out' }, 0);

      // 2. Fire — launch kick + chromatic aberration spike (skip jolts when reduced).
      if (!reduced) {
        tl.to(shot, { kickV: 1, duration: 0.07, ease: 'power3.out' }, 0.13)
          .to(shot, { kickV: 0, duration: 0.5, ease: 'power2.out' }, 0.2);
        tl.to(shot, { caV: 1, duration: 0.05, ease: 'power2.out' }, 0.13)
          .to(shot, { caV: 0, duration: 0.42, ease: 'power2.out' }, 0.19);
      }

      // 3. Travel — projectile crosses the field from button to core.
      tl.to(shot, { beam: 1, duration: 0.4 * d, ease: 'power2.in' }, 0.15);

      // 4. Ribbon — document chips stream the full path, through the core.
      tl.to(shot, { ribbon: 1, duration: 0.66 * d, ease: 'none' }, 0.16);

      // 5. Impact — strike the core: ripple impulse + expanding shockwave ring.
      tl.to(shot, { impactV: 1, duration: 0.05, ease: 'power3.out' }, 0.52)
        .to(shot, { impactV: 0, duration: 0.5 * d, ease: 'power2.out' }, 0.57);
      tl.to(shot, { ring: 1, duration: 0.5 * d, ease: 'power2.out' }, 0.53);

      // 6. Condense — a new row condenses out of a particle burst at the queue.
      tl.to(shot, { condense: 1, duration: 0.34 * d, ease: 'back.out(1.5)' }, 0.6);

      // Field-displacement window (active while the projectile is in flight).
      tl.call(() => {
        sendPulse.active = true;
      }, undefined, 0)
        .call(
          () => {
            sendPulse.active = false;
            sendPulse.travel = 0;
          },
          undefined,
          0.58 * d + 0.15,
        );

      // Tidy reset so a hidden idle frame starts clean.
      tl.set(shot, { charge: 0, beam: 0, ribbon: 0, ring: 0 }, '>+0.05');

      tl.timeScale(1 / shotScale);
      tlRef.current = tl;
    });
    return () => {
      unsub();
      tlRef.current?.kill();
      sendPulse.active = false;
    };
    // camera is stable for the canvas lifetime; capturePath reads it via closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame(() => {
    const shot = shotRef.current;
    const group = groupRef.current;
    if (!group) return;

    const anyActive =
      shot.charge > 0.001 ||
      shot.beam > 0.001 ||
      shot.ribbon > 0.001 ||
      shot.ring > 0.001 ||
      shot.condense > 0.001 ||
      shot.recoil > 0.001;
    group.visible = anyActive;

    // --- Charge packet at the button ---
    const charge = chargeRef.current;
    if (charge) {
      const show = shot.charge > 0.01 && shot.beam < 0.06 && shot.recoil < 0.01;
      charge.visible = show;
      if (show) {
        charge.position.copy(path.current.o);
        const s = 0.06 + shot.charge * 0.16;
        charge.scale.setScalar(s);
        (charge.material as THREE.MeshBasicMaterial).opacity = 0.5 + shot.charge * 0.4;
      }
    }

    // --- Beam projectile (fire) or reverse streak (recoil) ---
    const beam = beamRef.current;
    const head = headRef.current;
    const recoiling = shot.recoil > 0.001;
    const firing = !recoiling && shot.beam > 0.001 && shot.beam < 0.985;
    if (beam && head) {
      if (firing || recoiling) {
        const t = recoiling ? shot.recoil : shot.beam;
        legA(scratch.head, t);
        legA(scratch.tail, THREE.MathUtils.clamp(t - 0.2, 0, 1));
        const len = scratch.head.distanceTo(scratch.tail);
        scratch.dir.subVectors(scratch.head, scratch.tail);
        if (len > 1e-4) scratch.dir.multiplyScalar(1 / len);
        scratch.mid.copy(scratch.tail);
        scratch.quatA.setFromUnitVectors(scratch.up, scratch.dir);

        beam.visible = true;
        beam.position.copy(scratch.mid);
        beam.quaternion.copy(scratch.quatA);
        beam.scale.set(1, Math.max(len, 1e-3), 1);

        head.visible = true;
        head.position.copy(scratch.head);
        head.scale.setScalar(0.05 + Math.sin(Math.PI * THREE.MathUtils.clamp(t, 0, 1)) * 0.05);

        const col = recoiling ? DANGER : ACCENT;
        const beamMat = beam.material as THREE.MeshBasicMaterial;
        const headMat = head.material as THREE.MeshBasicMaterial;
        beamMat.color.copy(col);
        headMat.color.copy(col);
        beamMat.opacity = recoiling ? 0.7 * shot.recoil : 0.85;
        headMat.opacity = recoiling ? shot.recoil : 1;

        // Publish the projectile for the field / camera to react to.
        sendPulse.tipX = scratch.head.x;
        sendPulse.tipY = scratch.head.y;
        sendPulse.tipZ = scratch.head.z;
        sendPulse.travel = firing ? shot.beam : 0;
      } else {
        beam.visible = false;
        head.visible = false;
      }
    }

    // --- Impact shockwave ring at the core ---
    const ring = ringRef.current;
    if (ring) {
      const show = shot.ring > 0.001 && shot.ring < 0.999;
      ring.visible = show;
      if (show) {
        ring.position.copy(CORE);
        ring.quaternion.copy(camera.quaternion); // billboard
        ring.scale.setScalar(0.2 + shot.ring * 2.3);
        (ring.material as THREE.MeshBasicMaterial).opacity = (1 - shot.ring) * 0.9;
      }
    }

    // --- Document-chip ribbon, streaming through the core ---
    const ribbon = ribbonRef.current;
    if (ribbon) {
      const show = shot.ribbon > 0.001;
      ribbon.visible = show;
      if (show) {
        for (let i = 0; i < CHIP_COUNT; i++) {
          const frac = shot.ribbon * 1.16 - i * 0.1;
          const dummy = scratch.dummy;
          if (frac <= 0.001 || frac >= 1) {
            dummy.scale.setScalar(0);
          } else {
            fullPath(scratch.head, frac);
            dummy.position.copy(scratch.head);
            dummy.quaternion.copy(camera.quaternion); // billboard
            const pulse = 0.7 + Math.sin(Math.PI * frac) * 0.55;
            dummy.scale.set(pulse, pulse, pulse);
          }
          dummy.updateMatrix();
          ribbon.setMatrixAt(i, dummy.matrix);
        }
        ribbon.instanceMatrix.needsUpdate = true;
      }
    }

    // --- Condense burst at the queue → the new row ---
    const condense = condenseRef.current;
    if (condense) {
      const show = shot.condense > 0.001 && shot.condense < 0.999;
      condense.visible = show;
      if (show) {
        const attr = condense.geometry.getAttribute('position') as THREE.BufferAttribute;
        const arr = attr.array as Float32Array;
        const spread = 1 - shot.condense; // scattered → collapsed into the row
        for (let i = 0; i < CONDENSE_COUNT; i++) {
          arr[i * 3] = path.current.q.x + gfx.offsets[i * 3] * spread;
          arr[i * 3 + 1] = path.current.q.y + gfx.offsets[i * 3 + 1] * spread;
          arr[i * 3 + 2] = path.current.q.z + gfx.offsets[i * 3 + 2] * spread;
        }
        attr.needsUpdate = true;
        (condense.material as THREE.PointsMaterial).opacity = Math.sin(Math.PI * shot.condense) * 0.95;
      }
    }

    // --- Shared signals for the rest of the world ---
    sendPulse.impact = shot.impactV;
    sendPulse.kick = shot.kickV;
    sendPulse.ca = Math.max(shot.caV, shot.impactV * 0.85);
    sendPulse.danger = shot.dangerV;
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh ref={chargeRef} geometry={gfx.sphereGeo} material={gfx.chargeMat} visible={false} />
      <mesh ref={beamRef} geometry={gfx.beamGeo} material={gfx.beamMat} visible={false} />
      <mesh ref={headRef} geometry={gfx.sphereGeo} material={gfx.headMat} visible={false} />
      <mesh ref={ringRef} geometry={gfx.ringGeo} material={gfx.ringMat} visible={false} />
      <instancedMesh
        ref={ribbonRef}
        args={[gfx.chipGeo, gfx.chipMat, CHIP_COUNT]}
        visible={false}
        frustumCulled={false}
      />
      <points
        ref={condenseRef}
        geometry={gfx.condenseGeo}
        material={gfx.condenseMat}
        visible={false}
        frustumCulled={false}
      />
    </group>
  );
}
