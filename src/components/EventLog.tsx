"use client";

import { useContractEvents } from "@/hooks/useContractEvents";

export function EventLog() {
  const { events, loading, error } = useContractEvents();

  return (
    <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Contract Events</h3>
        {loading && events.length === 0 && (
          <span className="text-xs text-zinc-500">Loading...</span>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="max-h-64 overflow-y-auto space-y-2">
        {events.length === 0 ? (
          <p className="text-xs text-zinc-500">No events found yet.</p>
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
                  {JSON.stringify(ev.data, (_key, value) =>
                    typeof value === "bigint" ? value.toString() : value,
                  2)}
                </pre>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
