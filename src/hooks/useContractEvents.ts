"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { scValToNative } from "@stellar/stellar-sdk";
import { ESCROW_CONTRACT_ID, sorobanRpc } from "@/lib/stellar";

export type EscrowEventTopic =
  | "EscrowCreated"
  | "EscrowFunded"
  | "EscrowReleased"
  | "EscrowRefunded"
  | "EscrowDisputed"
  | "EscrowResolved"
  | "unknown";

export interface EscrowEvent {
  id: string;
  ledger: number;
  ledgerClosedAt: string;
  topic: EscrowEventTopic;
  data: unknown;
}

const EVENT_TOPICS: EscrowEventTopic[] = [
  "EscrowCreated",
  "EscrowFunded",
  "EscrowReleased",
  "EscrowRefunded",
  "EscrowDisputed",
  "EscrowResolved",
];

function parseTopic(raw: unknown[]): EscrowEventTopic {
  if (!raw.length) return "unknown";
  const first = raw[0];
  const value =
    typeof first === "string" ? first : scValToNative(first as never);
  return EVENT_TOPICS.includes(value as EscrowEventTopic)
    ? (value as EscrowEventTopic)
    : "unknown";
}

function clampBackoff(attempt: number): number {
  return Math.min(4000 * 2 ** attempt, 30000);
}

export function useContractEvents(pollIntervalMs = 4000) {
  const [events, setEvents] = useState<EscrowEvent[]>([]);
  const [filteredTopic, setFilteredTopic] = useState<EscrowEventTopic | "all">(
    "all"
  );
  const [latestLedger, setLatestLedger] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seenIds = useRef<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);
  const pollRef = useRef<() => Promise<void>>(async () => {});
  const consecutiveErrors = useRef(0);
  const maxEvents = 100;

  const filteredEvents =
    filteredTopic === "all"
      ? events
      : events.filter((e) => e.topic === filteredTopic);

  const poll = useCallback(async () => {
    if (!ESCROW_CONTRACT_ID) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

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

      if (controller.signal.aborted) return;

      const newEvents: EscrowEvent[] = [];

      for (const raw of response.events) {
        if (seenIds.current.has(raw.id)) continue;
        seenIds.current.add(raw.id);

        const topic = parseTopic(raw.topic ?? []);
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
            .slice(0, maxEvents)
        );
      }

      if (response.latestLedger) {
        setLatestLedger(response.latestLedger + 1);
      }

      consecutiveErrors.current = 0;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;

      consecutiveErrors.current += 1;
      const backoff = clampBackoff(consecutiveErrors.current);

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to fetch contract events");
      }

      // Exponential backoff: delay the next interval by re-scheduling.
      setTimeout(() => pollRef.current(), backoff);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [latestLedger]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!ESCROW_CONTRACT_ID) return;

    pollRef.current = poll;
    void poll();
    const interval = setInterval(() => pollRef.current(), pollIntervalMs);
    return () => {
      clearInterval(interval);
      abortRef.current?.abort();
    };
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [poll, pollIntervalMs]);

  return {
    events: filteredEvents,
    allEvents: events,
    loading,
    error,
    latestLedger,
    filteredTopic,
    setFilteredTopic,
  };
}
