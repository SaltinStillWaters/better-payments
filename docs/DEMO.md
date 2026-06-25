# Demo Script

A ~5-minute walkthrough of the full escrow lifecycle. You will need two testnet accounts (a **seller** and a **buyer**); an optional third account acts as an **arbitrator** for the dispute flow.

> Tip: open the app in two browser profiles (or two browsers) so the seller and buyer can each connect their own wallet.

## Setup

1. Deploy the contract and set `NEXT_PUBLIC_ESCROW_CONTRACT_ID` (see [DEPLOYMENT.md](DEPLOYMENT.md)).
2. `pnpm dev` and open [http://localhost:3000](http://localhost:3000).
3. In each wallet, switch to **Testnet**. If an account is unfunded, use **Fund with Friendbot** in the app.

## Happy path: create → fund → release

1. **Seller** connects their wallet.
2. In **Create Escrow**, enter the buyer's address and an amount (e.g. `10`), optionally a memo, and click **Create Escrow**. Approve in the wallet.
3. A QR code and **Escrow #N** appear. Copy the QR data or let the buyer scan it.
   - _Screenshot placeholder: seller QR code._
4. **Buyer** connects their wallet, goes to **Pay via Escrow**, and either scans the QR or enters the escrow ID and clicks **Look Up Escrow**.
5. The escrow details render with status **Created**. Click **Fund Escrow** and approve.
6. Status flips to **Funded**. Click **Release to Seller** and approve.
7. Status becomes **Released**; the seller receives the XLM.
8. Watch **Contract Events** show `EscrowCreated → EscrowFunded → EscrowReleased` in real time.
   - _Screenshot placeholder: event log._

## Refund path (timeout)

1. Create and fund an escrow as above (consider deploying with a short `ESCROW_TIMEOUT_SECONDS`, e.g. `60`, to demo quickly).
2. As the **buyer**, wait until **Refund available after** passes.
3. Click **Refund**. Status becomes **Refunded** and funds return to the buyer.

## Dispute path (arbitration)

1. When creating the escrow, the seller sets an **Arbitrator** address.
2. Buyer funds the escrow (status **Funded**).
3. Either the buyer or seller clicks **Dispute**; status becomes **Disputed**.
4. The **arbitrator** connects, looks up the escrow, and clicks **Resolve to Seller** or **Resolve to Buyer**.
5. Status becomes **Resolved** and funds move to the chosen party.

## Common pitfalls

| Symptom                                 | Cause                                                   | Fix                                               |
| --------------------------------------- | ------------------------------------------------------- | ------------------------------------------------- |
| "Wallet not connected" / wrong account  | Wallet on Mainnet or different account                  | Switch wallet to **Testnet**, reconnect           |
| Funding fails with insufficient balance | Account unfunded                                        | Use **Fund with Friendbot**                       |
| "Contract not found" on lookup          | Testnet reset or stale contract ID                      | Redeploy, update `NEXT_PUBLIC_ESCROW_CONTRACT_ID` |
| Refund button disabled                  | `timeout_at` not yet reached, or you are not the buyer  | Wait for the timeout; refund is buyer-only        |
| Resolve buttons hidden                  | You are not the arbitrator, or status is not `Disputed` | Connect the arbitrator account; dispute first     |
| Release disabled                        | Escrow not `Funded`, or you are not the buyer           | Fund first; release is buyer-only                 |

## Suggested recording

Record a short Loom/GIF covering: connect → create → scan QR → fund → release, then a second clip for dispute → resolve. Drop the links here:

- Demo video: _<add link>_
- Dispute demo: _<add link>_
