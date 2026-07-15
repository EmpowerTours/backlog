#!/usr/bin/env bash
# Deploy Backlog (attested) to Monad mainnet (chainid 143) and verify on MonadScan.
# Reads DEPLOYER_PRIVATE_KEY + MONADSCAN_API_KEY from ~/projects/monad-contracts/.env
# and SCORER_ADDRESS from ../.env.local (the off-chain scorer that signs writes).
set -euo pipefail

RPC="${MONAD_MAINNET_RPC:-https://rpc.monad.xyz}"
ENV_FILE="${DEPLOY_ENV:-$HOME/projects/monad-contracts/.env}"
if [ -f "$ENV_FILE" ]; then set -a; . "$ENV_FILE"; set +a; fi
# SCORER_ADDRESS lives in the app's .env.local
if [ -f "$(dirname "$0")/../.env.local" ]; then set -a; . "$(dirname "$0")/../.env.local"; set +a; fi

: "${DEPLOYER_PRIVATE_KEY:?set DEPLOYER_PRIVATE_KEY}"
: "${MONADSCAN_API_KEY:?set MONADSCAN_API_KEY}"
: "${SCORER_ADDRESS:?set SCORER_ADDRESS (the off-chain scorer that signs attestations)}"

cd "$(dirname "$0")"

echo "▶ [1/2] Deploying Backlog(scorer=$SCORER_ADDRESS) to Monad mainnet…"
OUT=$(forge create src/Backlog.sol:Backlog \
  --rpc-url "$RPC" \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --broadcast \
  --legacy \
  --constructor-args "$SCORER_ADDRESS")
echo "$OUT"
ADDR=$(echo "$OUT" | grep -i "Deployed to:" | awk '{print $3}')
echo "  Backlog: $ADDR"

echo "▶ [2/2] Verifying on MonadScan (Etherscan v2)…"
forge verify-contract "$ADDR" src/Backlog.sol:Backlog \
  --verifier-url "https://api.etherscan.io/v2/api?chainid=143" \
  --etherscan-api-key "$MONADSCAN_API_KEY" \
  --compiler-version 0.8.20 \
  --num-of-optimizations 200 \
  --constructor-args "$(cast abi-encode 'constructor(address)' "$SCORER_ADDRESS")" \
  --watch || echo "  (verification can be retried later; deployment succeeded)"

echo ""
echo "✓ Done. Next:"
echo "  1. Set NEXT_PUBLIC_BACKLOG_ADDRESS=$ADDR   (Railway + ../.env.local)"
echo "  2. Set SCORER_PRIVATE_KEY on Railway        (server signs attestations)"
echo "  3. Reconnect GitHub in the app → Write onchain"
echo "  Explorer: https://monadscan.com/address/$ADDR"
