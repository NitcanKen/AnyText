#!/usr/bin/env bash
# Reproducible build of the AnyText hero relay-core assets (pipeline Stage A + B).
# build_core.py is the AUTHORITATIVE geometry source; this script just chains the
# headless Blender build with the gltf-transform Draco optimize + inspect steps.
# The optimize flags disable join/flatten/palette so the named separable parts
# (hub, lens, ring.*, vanes, bolts, tube.blue.*) survive into the web GLB.
#
# NOTE: geometry-deterministic but NOT byte-reproducible — a rebuild yields identical
# structure (same parts/tri-count/size) but different bytes (Blender export + Draco are
# not bit-exact), so it dirties git. The committed .glb is canonical; only regenerate
# when intentionally changing the model, then commit the new artifact.
#
# Usage:  scripts/blender/build.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BLENDER="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
GLTF=(npx --yes @gltf-transform/cli@4)
RAW="$ROOT/scripts/blender/_build"
OPT=(--compress draco --flatten false --join false --simplify false --palette false --instance false)

echo "▸ Stage A — Blender headless build + preview render (build_core.py)"
"$BLENDER" -b -P "$ROOT/scripts/blender/build_core.py"

echo "▸ Stage B — Draco optimize (node-preserving)"
"${GLTF[@]}" optimize "$RAW/relay-core.raw.glb" "$ROOT/public/assets/relay-core.glb" "${OPT[@]}"
"${GLTF[@]}" optimize "$RAW/connectors.raw.glb" "$ROOT/public/assets/connectors.glb" "${OPT[@]}"

echo "▸ Inspect (budget gate: <=150 KB / <=40k tris, named parts intact)"
"${GLTF[@]}" inspect "$ROOT/public/assets/relay-core.glb"
echo "✓ Built public/assets/relay-core.glb + connectors.glb"
