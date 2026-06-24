export interface EscrowQrData {
  escrowId: number;
  contractId: string;
}

export function buildEscrowQrString(data: EscrowQrData): string {
  return JSON.stringify(data);
}

export function parseEscrowQrString(str: string): EscrowQrData | null {
  try {
    const parsed = JSON.parse(str);
    if (
      typeof parsed.escrowId === "number" &&
      typeof parsed.contractId === "string"
    ) {
      return parsed as EscrowQrData;
    }
    return null;
  } catch {
    return null;
  }
}

// Legacy SEP-7 helpers kept for reference if needed later.
export interface Sep7PayParams {
  destination: string;
  amount: string;
  memo?: string;
}

export function buildSep7PayUri({
  destination,
  amount,
  memo,
}: Sep7PayParams): string {
  const params = new URLSearchParams();
  params.set("destination", destination);
  params.set("amount", amount);
  params.set("network_passphrase", "Test SDF Network ; September 2015");

  if (memo && memo.trim()) {
    params.set("memo", memo.trim());
    params.set("memo_type", "text");
  }

  return `web+stellar:pay?${params.toString()}`;
}

export function parseSep7PayUri(uri: string): Sep7PayParams | null {
  try {
    const cleaned = uri.trim();
    if (!cleaned.startsWith("web+stellar:pay?")) {
      return null;
    }

    const queryString = cleaned.replace("web+stellar:pay?", "");
    const params = new URLSearchParams(queryString);

    const destination = params.get("destination");
    const amount = params.get("amount");

    if (!destination || !amount) {
      return null;
    }

    return {
      destination,
      amount,
      memo: params.get("memo") || undefined,
    };
  } catch {
    return null;
  }
}
