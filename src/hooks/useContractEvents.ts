"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { scValToNative } from "@stellar/stellar-sdk";
import { ESCROW_CONTRACT_ID, sorobanRpc } from "@/lib/stellar";

export interface EscrowEvent {
  id: string;
  ledger: number;
  ledgerClosedAt: string;
  topic: string;
  data: unknown;
}

export function useContractEvents(pollIntervalMs = 4000) {
  const [events, setEvents] = useState<EscrowEvent[]>([]);
  const [latestLedger, setLatestLedger] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seenIds = useRef<Set<string>>(new Set());

  const poll = useCallback(async () => {
    if (!ESCROW_CONTRACT_ID) return;

    setLoading(true);
    setError(null);

    try {
      let startLedger = latestLedger;
      if (startLedger === 0) {
        const latest = await sorobanRpc.getLatestLedger();
        startLedger = Math.max(1, latest.sequence - 10);
      }

      const response = await sorobanRpc.getEvents({
        startLedger,
        filters: [
          {
            type: "contract",
            contractIds: [ESCROW_CONTRACT_ID],
            topics: [["*"]],
          },
        ],
        limit: 100,
      });

      const newEvents: EscrowEvent[] = [];

      for (const raw of response.events) {
        if (seenIds.current.has(raw.id)) continue;
        seenIds.current.add(raw.id);

        const topic = raw.topic?.[0]
          ? (scValToNative(raw.topic[0]) as string)
          : "unknown";

        const data = scValToNative(raw.value);

        newEvents.push({
          id: raw.id,
          ledger: raw.ledger,
          ledgerClosedAt: raw.ledgerClosedAt,
          topic,
          data,
        });
      }

      if (newEvents.length > 0) {
        setEvents((prev) =>
          [...newEvents, ...prev]
            .sort((a, b) => b.ledger - a.ledger)
            .slice(0, 50)
        );
      }

      if (response.latestLedger) {
        setLatestLedger(response.latestLedger + 1);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to fetch contract events");
      }
    } finally {
      setLoading(false);
    }
  }, [latestLedger]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    // Poll the external Soroban RPC for contract events.
    if (!ESCROW_CONTRACT_ID) return;

    void poll();
    const interval = setInterval(poll, pollIntervalMs);
    return () => clearInterval(interval);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [poll, pollIntervalMs]);

  return { events, loading, error, latestLedger };
}
