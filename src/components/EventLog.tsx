"use client";

import { useContractEvents, EscrowEventTopic } from "@/hooks/useContractEvents";
import { SkeletonLoader } from "./SkeletonLoader";
import { RetryButton } from "./RetryButton";

const TOPIC_OPTIONS: Array<EscrowEventTopic | "all"> = [
  "all",
  "EscrowCreated",
  "EscrowFunded",
  "EscrowReleased",
  "EscrowRefunded",
  "EscrowDisputed",
  "EscrowResolved",
];

export function EventLog() {
  const { events, loading, error, filteredTopic, setFilteredTopic } =
    useContractEvents();

  return (
    <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold">Contract Events</h3>
        <div className="flex items-center gap-2">
          <label htmlFor="event-filter" className="sr-only">
            Filter events
          </label>
          <select
            id="event-filter"
            value={filteredTopic}
            onChange={(e) =>
              setFilteredTopic(e.target.value as EscrowEventTopic | "all")
            }
            className="min-h-[44px] rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          >
            {TOPIC_OPTIONS.map((topic) => (
              <option key={topic} value={topic}>
                {topic === "all" ? "All events" : topic}
              </option>
            ))}
          </select>
          {loading && events.length === 0 && (
            <span className="text-xs text-zinc-500">Loading...</span>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          <span>{error}</span>
          <RetryButton
            onRetry={() => window.location.reload()}
            label="Reload"
          />
        </div>
      )}

      <div className="max-h-64 overflow-y-auto space-y-2">
        {events.length === 0 ? (
          loading ? (
            <div className="space-y-2">
              <SkeletonLoader className="h-16 w-full" />
              <SkeletonLoader className="h-16 w-full" />
            </div>
          ) : (
            <p className="text-xs text-zinc-500">No events found yet.</p>
          )
        ) : (
          events.map((ev) => (
            <div
              key={ev.id}
              className="rounded-lg border border-zinc-100 bg-zinc-50 p-2 text-xs dark:border-zinc-800 dark:bg-zinc-800/50"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium text-blue-600">{ev.topic}</span>
                <span className="text-zinc-400">Ledger {ev.ledger}</span>
              </div>
              {ev.data !== null && (
                <pre className="overflow-x-auto rounded bg-white p-1.5 text-[10px] dark:bg-zinc-900">
                  {JSON.stringify(
                    ev.data,
                    (_key, value) =>
                      typeof value === "bigint" ? value.toString() : value,
                    2
                  )}
                </pre>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
