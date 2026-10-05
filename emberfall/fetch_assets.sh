#!/usr/bin/env bash
# Downloads the one external asset: Blender Studio's Security Bot from the open
# movie "Charge" (CC-BY 4.0, https://studio.blender.org/characters/security-bot/).
# ~75 MB, kept out of git under assets/.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p assets
if [ ! -f assets/secbot/security_bot_release_v1.blend ]; then
  curl -sSfL -o assets/secbot.zip \
    "https://studio.blender.org/download-source/files/f9/f99e59b56ce9b2cd560a98d453b12585/f99e59b56ce9b2cd560a98d453b12585.zip"
  rm -rf assets/tmp && unzip -q -o assets/secbot.zip -d assets/tmp
  rm -rf assets/secbot && mv assets/tmp/security_bot_v1 assets/secbot && rm -rf assets/tmp assets/secbot.zip
fi
echo "assets/secbot/security_bot_release_v1.blend ready"
