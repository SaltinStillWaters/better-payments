# Better Payments

A Next.js dapp for escrow-based XLM payments on the Stellar Testnet. Sellers can create escrow payment requests and share them as QR codes, and buyers can fund and release those escrows through a multi-wallet interface. The app also displays real-time contract events from the deployed Soroban escrow contract.

## Features

- **Multi-wallet support**: Freighter, LOBSTR, xBull, and Albedo
- **XLM balance** fetch and display
- **Escrow-based payments** powered by a Soroban smart contract
  - Seller creates an escrow with buyer, amount, and memo
  - Buyer funds the escrow with XLM
  - Buyer releases the escrow to forward XLM to the seller
- **QR-code payment requests** containing the escrow ID and contract address
- **Real-time contract event log** polled from Soroban RPC
- **Transaction feedback** with success/failure states and Stellar Expert testnet links
- **Error handling** for missing wallet, network mismatch, unfunded accounts, invalid escrow IDs, and contract-level errors

## Tech Stack

- [Next.js 16](https://nextjs.org/) (App Router + Turbopack)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Stellar SDK](https://github.com/stellar/js-stellar-sdk)
- [Stellar Wallets Kit](https://stellarwalletskit.dev/) for multi-wallet integration
- [Soroban SDK](https://github.com/stellar/rs-soroban-sdk) (Rust) for the escrow contract
- QR generation with [qrcode.react](https://github.com/zpao/qrcode.react)
- QR scanning with [@yudiel/react-qr-scanner](https://github.com/yudielcurbelo/react-qr-scanner)

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

Copy the example environment file:

```bash
cp .env.local.example .env.local
```

The defaults point to Stellar Testnet. After deploying the escrow contract (see below), set the returned contract ID:

```bash
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
NEXT_PUBLIC_FRIENDBOT_URL=https://friendbot.stellar.org
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_ESCROW_CONTRACT_ID=<your-deployed-contract-id>
NEXT_PUBLIC_XLM_SAC_ADDRESS=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
```

### 3. Run the development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Install and configure a wallet

1. Install one of the supported wallet extensions: [Freighter](https://www.freighter.app/), [LOBSTR](https://lobstr.co/), [xBull](https://xbull.app/), or [Albedo](https://albedo.link/).
2. Create or import a wallet.
3. Switch the wallet to **Testnet** in its settings.

### 5. Test the escrow flow

1. Connect your wallet via the multi-wallet modal.
2. If your account is unfunded, click **Fund with Friendbot**.
3. **Receive (Seller)**:
   - Enter the buyer address, amount, and optional memo.
   - Click **Create Escrow** and approve the transaction.
   - Share the generated QR code or escrow ID with the buyer.
4. **Pay (Buyer)**:
   - Switch to the Pay tab and scan the QR code (or enter the escrow ID manually).
   - Click **Look Up Escrow** to verify the details.
   - Click **Fund Escrow** and approve the transaction.
   - Click **Release to Seller** and approve the transaction.
5. Watch the **Contract Events** section update in real time as each step completes.
6. View transaction hashes on [Stellar Expert Testnet](https://stellar.expert/explorer/testnet).

## Deploying the Escrow Contract

The frontend expects a deployed Soroban escrow contract on Testnet.

### Prerequisites

- Rust toolchain with the `wasm32v1-none` target:
  ```bash
  rustup target add wasm32v1-none
  ```
- [Stellar CLI](https://developers.stellar.org/docs/tools/stellar-cli) installed

### Build

```bash
cd contract
cargo build --target wasm32v1-none --release
```

### Deploy

```bash
stellar keys generate escrow-deployer --network testnet --fund
stellar contract deploy \
  --wasm contract/target/wasm32v1-none/release/escrow.wasm \
  --source escrow-deployer \
  --network testnet
```

Copy the returned contract ID (starts with `C`) into `.env.local` as `NEXT_PUBLIC_ESCROW_CONTRACT_ID`.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start the development server |
| `pnpm build` | Build for production |
| `pnpm start` | Start the production server |
| `pnpm lint` | Run ESLint |
| `cargo build --target wasm32v1-none --release` | Build the Soroban escrow contract |

## Project Structure

```
better-payments/
├── contract/            # Rust Soroban escrow contract
├── src/
│   ├── app/             # Next.js App Router pages
│   ├── components/      # React components
│   ├── hooks/           # Custom React hooks
│   └── lib/             # Stellar, transaction, balance, and QR utilities
├── .env.local.example   # Example environment variables
└── README.md
```

## Notes

- This dapp is configured for **Stellar Testnet** only.
- All wallet and contract interactions happen client-side.
- The escrow contract uses the Stellar Asset Contract (SAC) for native XLM transfers.
- Contract events are polled from Soroban RPC every few seconds (Soroban RPC does not yet support streaming).
