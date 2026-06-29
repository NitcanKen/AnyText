/**
 * AnchorBridge — the Phase 0 proof that DOM and WebGL share coordinates (SoT §3.1).
 * Reads the real Send button's screen rect from the Anchor registry each frame and
 * unprojects it into world space, parking a marker there. In Phase 2 this same
 * projection is where the volumetric beam originates.
 *
 * Off by default (it would clutter the deck); enable with `?debugAnchor=1` to see /
 * verify the marker lock onto the live button. The projection runs regardless so the
 * bridge is exercised, the marker is just hidden.
 */

import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { readAnchor } from '../anchors';

const SCRATCH = new THREE.Vector3();

export function AnchorBridge({ id = 'send', debug = false }: { id?: string; debug?: boolean }) {
  const camera = useThree((s) => s.camera);
  const markerRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const marker = markerRef.current;
    if (!marker) return;
    const anchor = readAnchor(id);
    if (!anchor) {
      marker.visible = false;
      return;
    }
    // Unproject the anchor's NDC at a mid clip-depth so the marker rides at a
    // comfortable distance in front of the camera, screen-locked to the button.
    SCRATCH.set(anchor.ndcX, anchor.ndcY, 0.6).unproject(camera);
    marker.position.copy(SCRATCH);
    marker.visible = debug;
  });

  if (!debug) {
    // Still mount (and run the projection) so the bridge is live, but render an
    // invisible marker.
    return (
      <mesh ref={markerRef} visible={false}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshBasicMaterial color="#befc3c" />
      </mesh>
    );
  }

  return (
    <mesh ref={markerRef}>
      <sphereGeometry args={[0.06, 16, 16]} />
      <meshBasicMaterial color="#befc3c" toneMapped={false} />
    </mesh>
  );
}
