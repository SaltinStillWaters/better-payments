# Better Payments

A simple Next.js dapp for fast XLM payments on the Stellar Testnet. Sellers can generate QR-code payment requests, and buyers can scan or paste the payment URI to pay with their Freighter wallet.

## Features

- **Freighter wallet** integration (connect / disconnect)
- **XLM balance** fetch and display
- **Receive payments** via SEP-7 QR codes
- **Send payments** by scanning a QR code or entering details manually
- **Transaction feedback** with success/failure states and Stellar Expert testnet links
- **Error handling** for missing wallet, network mismatch, unfunded accounts, and transaction failures

## Tech Stack

- [Next.js 15](https://nextjs.org/) (App Router + Turbopack)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Stellar SDK](https://github.com/stellar/js-stellar-sdk)
- [Freighter API](https://github.com/stellar/freighter)
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

The defaults point to Stellar Testnet:

```bash
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
NEXT_PUBLIC_FRIENDBOT_URL=https://friendbot.stellar.org
```

### 3. Run the development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Install and configure Freighter

1. Install the [Freighter browser extension](https://www.freighter.app/).
2. Create or import a wallet.
3. Switch Freighter to **Testnet** in the wallet settings.

### 5. Test the payment flow

1. Connect your wallet.
2. If your account is unfunded, click **Fund with Friendbot**.
3. **Receive (Seller)**: enter an amount, click **Generate QR Code**, and share the QR code or URI.
4. **Pay (Buyer)**: switch to the Pay tab, scan the QR code or paste the URI, and click **Pay**.
5. Approve the transaction in Freighter.
6. View the transaction hash on [Stellar Expert Testnet](https://stellar.expert/explorer/testnet).

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start the development server |
| `pnpm build` | Build for production |
| `pnpm start` | Start the production server |
| `pnpm lint` | Run ESLint |

## Project Structure

```
src/
├── app/                 # Next.js App Router pages
├── components/          # React components
├── hooks/               # Custom React hooks
└── lib/                 # Stellar, transaction, balance, and QR utilities
```

## Notes

- This dapp is configured for **Stellar Testnet** only.
- All wallet interactions happen client-side because Freighter requires a browser context.
- QR payment URIs follow the [SEP-7](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0007.md) `web+stellar:pay` scheme.
