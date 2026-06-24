import { Horizon, Networks } from "@stellar/stellar-sdk";

export const NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet";

export const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL || "https://horizon-testnet.stellar.org";

export const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || Networks.TESTNET;

export const FRIENDBOT_URL =
  process.env.NEXT_PUBLIC_FRIENDBOT_URL || "https://friendbot.stellar.org";

export const horizon = new Horizon.Server(HORIZON_URL, {
  allowHttp: HORIZON_URL.startsWith("http://"),
});

export async function fundWithFriendbot(address: string): Promise<void> {
  const url = new URL(FRIENDBOT_URL);
  url.searchParams.set("addr", address);
  const response = await fetch(url.toString(), { method: "GET" });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Friendbot funding failed: ${response.status} ${text}`);
  }
}

export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
