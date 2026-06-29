/**
 * Lighting — studio HDRI reflections + high-contrast sculpting (SoT §7.7).
 *
 * The grade lives here as much as in PostFX:
 *  - The PolyHaven HDRI is the *environment* (reflections that make dark metal read
 *    as a render) but NOT the background and NOT at full strength — a bright HDRI on
 *    metalness=1 blows out, so environmentIntensity stays well under 1.
 *  - A warm key + a strong electric-blue rim + a soft fill do the sculpting; a faint
 *    lime kiss seats the action color into the metal. Black + royal-blue + lime triad,
 *    cyan stays reserved for remote arrival.
 */

import { Environment } from '@react-three/drei';
import { ASSET } from '../assets';

export function Lighting() {
  return (
    <>
      {/* Reflections only — `background` stays off so the stage reads near-black. */}
      <Environment files={ASSET.hdri} environmentIntensity={0.6} environmentRotation={[0, 2.1, 0]} />

      {/* Warm grazing key. */}
      <directionalLight position={[4.5, 6, 5]} intensity={3.0} color="#fff3e2" />
      {/* Electric-blue rim — the signature hard speculars on the machined edges. */}
      <directionalLight position={[-6, -1.5, -5]} intensity={4.6} color="#2f6bff" />
      {/* Soft blue fill so the shadow side never vanishes into the black. */}
      <directionalLight position={[-2.5, -3, 2]} intensity={0.6} color="#9ab4ff" />
      {/* Faint lime kiss — action color seated into the metal, kept low. */}
      <pointLight position={[-3.4, -1.4, 2.4]} intensity={6} distance={12} decay={2} color="#befc3c" />
      <ambientLight intensity={0.18} color="#16203a" />
    </>
  );
}
