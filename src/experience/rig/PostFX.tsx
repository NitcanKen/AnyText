/**
 * PostFX — the global grade (SoT §7.7). This is where "effects" become "a render".
 *
 * Pipeline (renderer is set to NoToneMapping in Experience, so the scene lands in a
 * HalfFloat HDR buffer with emissives > 1 intact):
 *   Bloom  — a SCALPEL: low intensity + HIGH threshold (0.72) so only the lens
 *            emissive and the hottest blue speculars bloom, never a white wash.
 *   DOF    — bokeh on the depth-staggered glossy spheres, core kept sharp.
 *   AGX    — tone map last-but-one, matching the Blender AgX preview's contrast.
 *   Noise  — a whisper of film grain in display space.
 *
 * Tier-gated: A gets the full chain + MSAA; B drops DOF; C is bloom + tone map only.
 */

import { Bloom, DepthOfField, EffectComposer, Noise, ToneMapping } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import { HalfFloatType } from 'three';
import type { QualityTier } from '../quality';

export function PostFX({ tier }: { tier: QualityTier }) {
  const withDOF = tier === 'A';
  const withGrain = tier === 'A' || tier === 'B';
  const bloomIntensity = tier === 'C' ? 0.5 : 0.7;

  return (
    <EffectComposer frameBufferType={HalfFloatType} multisampling={tier === 'A' ? 2 : 0}>
      <Bloom
        intensity={bloomIntensity}
        luminanceThreshold={0.72}
        luminanceSmoothing={0.18}
        radius={0.7}
        mipmapBlur
      />
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
  );
}
