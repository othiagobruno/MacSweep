#!/usr/bin/env bash
# Uploads the code-signing and notarization secrets used by
# .github/workflows/release.yml to the GitHub repository.
#
# Usage:
#   scripts/setup-release-secrets.sh <developer-id.p12> <AuthKey_XXXX.p8> <key-id> <issuer-id>
#
#   developer-id.p12  "Developer ID Application" certificate + private key,
#                     exported from Keychain Access (you'll be asked its password)
#   AuthKey_XXXX.p8   App Store Connect API key (Users and Access → Integrations)
#   key-id            The API key's Key ID
#   issuer-id         The Issuer ID shown above the API keys list
set -euo pipefail

if [ $# -ne 4 ]; then
  sed -n 5,13p "$0"
  exit 1
fi

P12="$1" P8="$2" KEY_ID="$3" ISSUER="$4"
REPO="othiagobruno/cleanmymac"

read -rsp "Password of $P12: " P12_PASSWORD
echo

base64 -i "$P12" | gh secret set CSC_LINK -R "$REPO"
printf '%s' "$P12_PASSWORD" | gh secret set CSC_KEY_PASSWORD -R "$REPO"
gh secret set APPLE_API_KEY_P8 -R "$REPO" < "$P8"
printf '%s' "$KEY_ID" | gh secret set APPLE_API_KEY_ID -R "$REPO"
printf '%s' "$ISSUER" | gh secret set APPLE_API_ISSUER -R "$REPO"

echo "Secrets set on $REPO:"
gh secret list -R "$REPO"
