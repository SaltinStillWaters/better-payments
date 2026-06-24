import { horizon } from "./stellar";

interface NativeBalance {
  asset_type: "native";
  balance: string;
}

function isNativeBalance(b: unknown): b is NativeBalance {
  return (
    typeof b === "object" &&
    b !== null &&
    "asset_type" in b &&
    (b as { asset_type: string }).asset_type === "native" &&
    "balance" in b
  );
}

export async function getBalance(address: string): Promise<string> {
  try {
    const account = await horizon.loadAccount(address);
    const nativeBalance = account.balances.find(isNativeBalance);
    return nativeBalance?.balance || "0";
  } catch (error: unknown) {
    if (error instanceof Error && "response" in error) {
      const response = (error as { response?: { status?: number } }).response;
      if (response?.status === 404) {
        return "0";
      }
    }
    throw error;
  }
}
