#!/usr/bin/env bash
# Deploy Backlog to Monad mainnet (chainid 143) and verify on MonadScan.
# Reads DEPLOYER_PRIVATE_KEY + MONADSCAN_API_KEY from ~/projects/monad-contracts/.env
# (override by exporting them yourself first).
set -euo pipefail

RPC="${MONAD_MAINNET_RPC:-https://rpc.monad.xyz}"
ENV_FILE="${DEPLOY_ENV:-$HOME/projects/monad-contracts/.env}"
if [ -f "$ENV_FILE" ]; then set -a; . "$ENV_FILE"; set +a; fi

: "${DEPLOYER_PRIVATE_KEY:?set DEPLOYER_PRIVATE_KEY}"
: "${MONADSCAN_API_KEY:?set MONADSCAN_API_KEY}"

cd "$(dirname "$0")"

echo "▶ [1/2] Deploying Backlog to Monad mainnet…"
OUT=$(forge create src/Backlog.sol:Backlog \
  --rpc-url "$RPC" \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --broadcast \
  --legacy)
echo "$OUT"
ADDR=$(echo "$OUT" | grep -i "Deployed to:" | awk '{print $3}')
echo "  Backlog: $ADDR"

echo "▶ [2/2] Verifying on MonadScan (Etherscan v2)…"
forge verify-contract "$ADDR" src/Backlog.sol:Backlog \
  --verifier-url "https://api.etherscan.io/v2/api?chainid=143" \
  --etherscan-api-key "$MONADSCAN_API_KEY" \
  --compiler-version 0.8.20 \
  --num-of-optimizations 200 \
  --watch || echo "  (verification can be retried later; deployment succeeded)"

echo ""
echo "✓ Done. Next:"
echo "  1. echo \"NEXT_PUBLIC_BACKLOG_ADDRESS=$ADDR\" >> ../.env.local"
echo "  2. echo \"BACKLOG_ADDRESS=$ADDR\" >> ~/.backlog/env"
echo "  3. node ../cli/sync.mjs        # score projects + write portfolio onchain"
echo "  Explorer: https://monadscan.com/address/$ADDR"
