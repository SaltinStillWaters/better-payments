#!/usr/bin/env bash
set -euo pipefail

# Local deployment script for the Better Payments escrow contract.
# Reads configuration from .env.local and deploys to Stellar Testnet.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

ENV_FILE="$ROOT_DIR/.env.local"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE not found. Copy .env.local.example to .env.local and fill it in."
  exit 1
fi

# shellcheck source=/dev/null
set -a
source "$ENV_FILE"
set +a

ADMIN_ADDRESS="${ADMIN_ADDRESS:-}"
ESCROW_TIMEOUT_SECONDS="${ESCROW_TIMEOUT_SECONDS:-604800}"
TOKEN_ADDRESS="${TOKEN_ADDRESS:-$NEXT_PUBLIC_TOKEN_ADDRESS}"

if [[ -z "$ADMIN_ADDRESS" ]]; then
  echo "Error: ADMIN_ADDRESS is not set in .env.local"
  exit 1
fi

if [[ -z "$TOKEN_ADDRESS" ]]; then
  echo "Error: TOKEN_ADDRESS or NEXT_PUBLIC_TOKEN_ADDRESS is not set"
  exit 1
fi

echo "Building escrow contract..."
cd "$ROOT_DIR/contracts"
cargo build --target wasm32v1-none --release

WASM="$ROOT_DIR/contracts/target/wasm32v1-none/release/escrow.wasm"

# Generate or ensure a funded deployer identity.
if ! stellar keys address escrow-deployer >/dev/null 2>&1; then
  echo "Creating and funding deployer identity..."
  stellar keys generate escrow-deployer --network testnet --fund
fi

echo "Deploying contract..."
CONTRACT_ID=$(stellar contract deploy \
  --wasm "$WASM" \
  --source escrow-deployer \
  --network testnet)

echo ""
echo "Deployed escrow contract: $CONTRACT_ID"
echo ""

# The contract uses an explicit initialize() function (not a constructor),
# so initialization is a separate invocation. The admin must match the
# --source key so initialize()'s require_auth is satisfied.
echo "Initializing contract..."
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source escrow-deployer \
  --network testnet \
  -- \
  initialize \
  --admin "$ADMIN_ADDRESS" \
  --timeout_seconds "$ESCROW_TIMEOUT_SECONDS" \
  --xlm_sac_address "$TOKEN_ADDRESS"

echo ""
echo "Contract initialized (admin=$ADMIN_ADDRESS, timeout=${ESCROW_TIMEOUT_SECONDS}s)"
echo ""

# Update .env.local with the new contract ID.
if grep -q "^NEXT_PUBLIC_ESCROW_CONTRACT_ID=" "$ENV_FILE"; then
  sed -i "s/^NEXT_PUBLIC_ESCROW_CONTRACT_ID=.*/NEXT_PUBLIC_ESCROW_CONTRACT_ID=$CONTRACT_ID/" "$ENV_FILE"
else
  echo "NEXT_PUBLIC_ESCROW_CONTRACT_ID=$CONTRACT_ID" >> "$ENV_FILE"
fi

echo "Updated NEXT_PUBLIC_ESCROW_CONTRACT_ID in $ENV_FILE"
