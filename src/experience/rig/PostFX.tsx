/**
 * PostFX — the global grade (SoT §7.7). This is where "effects" become "a render".
 *
 * Pipeline (renderer is set to NoToneMapping in Experience, so the scene lands in a
 * HalfFloat HDR buffer with emissives > 1 intact):
 *   Bloom  — a SCALPEL: low intensity + HIGH threshold (0.72) so only the lens
 *            emissive and the hottest blue speculars bloom, never a white wash.
 *   CA     — chromatic aberration, idle at zero; the SendBeam spikes it on launch +
 *            impact (SoT §3 / §5.2 "ChromaticAberration on impact").
 *   DOF    — bokeh on the depth-staggered glossy spheres, core kept sharp.
 *   AGX    — tone map last-but-one, matching the Blender AgX preview's contrast.
 *   Noise  — a whisper of film grain in display space.
 *
 * Tier-gated: A gets the full chain + MSAA; B drops DOF; C is bloom + tone map only.
 *
 * The CA effect is built imperatively and inserted via `<primitive>` (the same path
 * the library's own DepthOfField wrapper uses) rather than the declarative
 * `<ChromaticAberration>` — that wrapper `JSON.stringify`s its props each render
 * (circular on a Three object) and never forwards a ref. Imperative gives a stable
 * handle to mutate `offset` per frame.
 */

import { Bloom, DepthOfField, EffectComposer, Noise, ToneMapping } from '@react-three/postprocessing';
import { useFrame } from '@react-three/fiber';
import { BlendFunction, ChromaticAberrationEffect, ToneMappingMode } from 'postprocessing';
import { useEffect, useMemo } from 'react';
import { HalfFloatType, Vector2 } from 'three';
import type { QualityTier } from '../quality';
import { sendPulse } from '../store';

// Idle at zero (a clean grade, §7.7); the SendBeam spikes `sendPulse.ca` on launch
// and impact, and this rides it. Kept tiny — a flicker of fringe, not a smear.
const CA_MAX = new Vector2(0.0022, 0.0014);

/** Drives the chromatic-aberration offset from the send pulse. A plain Canvas child
 * (not an EffectComposer pass) so it can `useFrame`; mutates the effect's uniform. */
function ChromaticDriver({ effect }: { effect: ChromaticAberrationEffect }) {
  useFrame(() => {
    effect.offset.set(CA_MAX.x * sendPulse.ca, CA_MAX.y * sendPulse.ca);
  });
  return null;
}

export function PostFX({ tier }: { tier: QualityTier }) {
  const withDOF = tier === 'A';
  const withGrain = tier === 'A' || tier === 'B';
  const bloomIntensity = tier === 'C' ? 0.5 : 0.7;

  const ca = useMemo(
    () =>
      new ChromaticAberrationEffect({
        blendFunction: BlendFunction.NORMAL,
        offset: new Vector2(0, 0),
        radialModulation: false,
        modulationOffset: 0,
      }),
    [],
  );
  useEffect(() => () => ca.dispose(), [ca]);

  return (
    <>
      <ChromaticDriver effect={ca} />
      <EffectComposer frameBufferType={HalfFloatType} multisampling={tier === 'A' ? 2 : 0}>
        <Bloom
          intensity={bloomIntensity}
          luminanceThreshold={0.72}
          luminanceSmoothing={0.18}
          radius={0.7}
          mipmapBlur
        />
        <primitive object={ca} />
        {withDOF ? (
          <DepthOfField
            target={[0, 0.1, 0]}
            focalLength={0.02}
            focusRange={0.01}
            bokehScale={3.4}
            height={700}
          />
        ) : (
          <></>
        )}
        <ToneMapping mode={ToneMappingMode.AGX} />
        {withGrain ? (
          <Noise premultiply blendFunction={BlendFunction.OVERLAY} opacity={0.04} />
        ) : (
          <></>
        )}
      </EffectComposer>
    </>
  );
}
