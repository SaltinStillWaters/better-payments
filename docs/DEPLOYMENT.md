# Deployment

This project deploys in two parts: the **Soroban escrow contract** (to Stellar Testnet) and the **Next.js frontend** (any Node host or container). The contract ID links them via `NEXT_PUBLIC_ESCROW_CONTRACT_ID`.

## Prerequisites

- Rust toolchain with the `wasm32v1-none` target:
  ```bash
  rustup target add wasm32v1-none
  ```
- [Stellar CLI](https://developers.stellar.org/docs/tools/stellar-cli)
- Node 22 + pnpm 9

## Local deployment (recommended)

The escrow contract requires an `initialize` call at deploy time, so use the provided script rather than a bare `contract deploy`.

1. Copy and fill in the environment file:

   ```bash
   cp .env.local.example .env.local
   ```

   Set at least `ADMIN_ADDRESS` (the address that will administer the contract). `ESCROW_TIMEOUT_SECONDS` defaults to `604800` (7 days), and `TOKEN_ADDRESS` defaults to `NEXT_PUBLIC_TOKEN_ADDRESS` (native XLM SAC).

2. Run the deploy script:
   ```bash
   pnpm contract:deploy
   ```

The script (`scripts/deploy.sh`):

- Builds the WASM (`cargo build --target wasm32v1-none --release`).
- Creates and funds a `escrow-deployer` identity if one does not exist.
- Deploys the contract and runs `initialize` with `--admin`, `--timeout_seconds`, and `--xlm_sac_address`.
- Writes the returned contract ID back into `.env.local` as `NEXT_PUBLIC_ESCROW_CONTRACT_ID`.

3. Restart `pnpm dev` so the new contract ID is picked up.

### Manual deployment

```bash
cd contract
cargo build --target wasm32v1-none --release

stellar keys generate escrow-deployer --network testnet --fund

stellar contract deploy \
  --wasm target/wasm32v1-none/release/escrow.wasm \
  --source escrow-deployer \
  --network testnet \
  -- \
  initialize \
  --admin <ADMIN_ADDRESS> \
  --timeout_seconds 604800 \
  --xlm_sac_address CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
```

Copy the printed contract ID (starts with `C`) into `.env.local`.

## Contract ID management

- The active testnet contract ID lives in `.env.local` (and `.env.local.example` documents the last known deployed ID).
- **Testnet resets** periodically wipe deployed contracts. If lookups start failing with "contract not found," redeploy and update the contract ID.
- For hosted frontends, set `NEXT_PUBLIC_ESCROW_CONTRACT_ID` as an environment variable in the host (e.g. Vercel project settings) rather than committing it.

## CI/CD pipelines

### CI — `.github/workflows/ci.yml`

Runs on push and PR to `main`:

- **Contract job**: installs Rust + `wasm32v1-none`, caches deps, runs `cargo test`, and builds the release WASM.
- **Frontend job**: installs pnpm deps, runs `pnpm format:check`, `pnpm lint`, `pnpm test`, and `pnpm build`.

### Deploy — `.github/workflows/deploy.yml`

Manual/release-triggered:

- Builds and deploys the contract to testnet using the `STELLAR_ESCROW_DEPLOYER_KEY` GitHub secret.
- Builds the frontend artifact with the resulting contract ID.

Configure the secret under **Settings → Secrets and variables → Actions**.

## Docker

A multi-stage `Dockerfile` builds the contract WASM and the Next.js standalone output, then runs the server on port 3000.

```bash
docker compose up --build
```

`next.config.ts` is set to `output: "standalone"` so the runtime image ships only the necessary files. `docker-compose.yml` defines the `app` service (and can host an optional Stellar quickstart for local integration testing).

## Verification checklist

```bash
cd contract && cargo test && cargo build --target wasm32v1-none --release
cd .. && pnpm install && pnpm format:check && pnpm lint && pnpm test && pnpm build
pnpm contract:deploy   # requires ADMIN_ADDRESS in .env.local
```
