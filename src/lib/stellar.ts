import { Horizon, Networks, rpc } from "@stellar/stellar-sdk";

export const NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet";

export const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL || "https://horizon-testnet.stellar.org";

export const SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ||
  "https://soroban-testnet.stellar.org";

export const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || Networks.TESTNET;

export const FRIENDBOT_URL =
  process.env.NEXT_PUBLIC_FRIENDBOT_URL || "https://friendbot.stellar.org";

export const ESCROW_CONTRACT_ID =
  process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID || "";

export const XLM_SAC_ADDRESS =
  process.env.NEXT_PUBLIC_XLM_SAC_ADDRESS ||
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

export const horizon = new Horizon.Server(HORIZON_URL, {
  allowHttp: HORIZON_URL.startsWith("http://"),
});

export const sorobanRpc = new rpc.Server(SOROBAN_RPC_URL, {
  allowHttp: SOROBAN_RPC_URL.startsWith("http://"),
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

export function xlmToStroops(xlm: string): bigint {
  const parsed = Number(xlm);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error("Invalid XLM amount");
  }
  return BigInt(Math.round(parsed * 10_000_000));
}

export function stroopsToXlm(stroops: bigint | string): string {
  const value = typeof stroops === "string" ? BigInt(stroops) : stroops;
  return (Number(value) / 10_000_000).toString();
}
