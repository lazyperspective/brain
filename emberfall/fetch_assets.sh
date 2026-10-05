#!/usr/bin/env bash
# Downloads the CC0 "Human Base Meshes" bundle from Blender Studio, used as the
# base body for the courier. ~50 MB, kept out of git under assets/.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p assets
URL=https://download.blender.org/demo/asset-bundles/human-base-meshes
F=human-base-meshes-bundle-v1.4.1.zip
[ -f assets/hbm/human_base_meshes_bundle.blend ] && { echo "already fetched"; exit 0; }
curl -sSfL -o "assets/$F" "$URL/$F"
unzip -q -o "assets/$F" -d assets/tmp
mv assets/tmp/*/ assets/hbm && rm -rf assets/tmp "assets/$F"
echo "fetched assets/hbm/human_base_meshes_bundle.blend"
