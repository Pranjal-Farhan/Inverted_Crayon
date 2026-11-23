"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { prepareThumbnails } from "@/actions/admin-thumbs";

/**
 * The thumbnail bar at the top of the Products page — always there, so the state of the hover wheel's
 * small pictures is always in view: "N of M photos ready", when the numbers were last read, a Refresh
 * button, and — while any photo has none — "Prepare photo thumbnails".
 *
 * Photos uploaded before thumbnails existed have none, so the hover wheel has to make each one the
 * first time it is asked for (slow — it downloads the full-size original). Preparing makes them all
 * now, a batch at a time, with a running count. Closing the page part-way is safe: every thumbnail
 * is saved as soon as it is made, and the next visit shows what is still left.
 */
export function PrepareThumbsButton({
  total,
  missing,
  unsupported,
  checkedAt,
}: {
  total: number;
  missing: number;
  /** Live photos whose address can't be turned into a thumbnail at all (not a web address). */
  unsupported: number;
  /** When the server read these numbers (ms since 1970). */
  checkedAt: number;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [left, setLeft] = useState(missing);
  const [made, setMade] = useState(0);
  const [stuck, setStuck] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);

  async function run() {
    setPhase("running");
    setError(null);
    setLeft(missing);
    let skip: string[] = [];
    let madeTotal = 0;
    // Each call does a batch within its time budget; stop when none are left, when a call makes
    // none at all (what remains can't be fetched), or after a generous number of rounds.
    for (let round = 0; round < 100; round++) {
      let r;
      try {
        r = await prepareThumbnails(skip);
      } catch {
        setError("The request didn't come back. Press the button again to carry on from where it stopped.");
        break;
      }
      if (!r.ok) {
        setError(r.error);
        break;
      }
      skip = [...skip, ...r.failed];
      madeTotal += r.made;
      setMade(madeTotal);
      setLeft(r.remaining);
      setStuck(skip.length);
      setReasons((old) => [...new Set([...old, ...r.reasons])].slice(0, 4));
      if (r.remaining === 0 || r.made === 0) break;
    }
    setPhase("done");
    startRefresh(() => router.refresh());
  }

  const running = phase === "running";
  // While preparing, the live count; otherwise what the server last read.
  const shownMissing = running ? left + stuck : missing;
  const shownReady = Math.max(0, total - shownMissing);
  const pct = total === 0 ? 100 : Math.round((shownReady / total) * 100);
  const complete = shownMissing === 0;

  return (
    <div className="mb-3.5 border border-line bg-panel px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-medium">
              Photo thumbnails: {shownReady} of {total} ready
            </span>
            <span className={complete ? "text-lime" : "text-yellow"}>
              {complete ? "all ready" : `${shownMissing} ${shownMissing === 1 ? "photo has" : "photos have"} none yet`}
            </span>
            <span className="text-[12px] text-muted" suppressHydrationWarning>
              checked {new Date(checkedAt).toLocaleTimeString()}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full max-w-md bg-line" aria-hidden="true">
            <div className={`h-full ${complete ? "bg-lime" : "bg-yellow"}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => startRefresh(() => router.refresh())}
            disabled={running || refreshing}
            className="border border-line-2 px-3.5 py-2 text-sm hover:border-lime disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          {!complete && (
            <button
              type="button"
              onClick={run}
              disabled={running}
              className="border border-line-2 px-3.5 py-2 text-sm hover:border-lime disabled:opacity-50"
            >
              {running ? "Preparing…" : "Prepare photo thumbnails"}
            </button>
          )}
        </div>
      </div>
      {!complete && !running && phase === "idle" && (
        <div className="mt-1.5 text-[13px] text-muted">
          The hover wheel on the shop fills its circles slowly for photos without one. Preparing them now makes it instant — keep this page open while it runs (closing it is safe; press again to carry on).
        </div>
      )}
      {running && <div className="mt-1.5 text-[13px] text-lime">Preparing… {made} done, {left} to go (keep this page open)</div>}
      {phase === "done" && !error && (
        <div className="mt-1.5 text-[13px] text-lime">
          Made {made}.{stuck > 0 && <span className="text-yellow"> {stuck} couldn&apos;t be prepared{reasons.length > 0 ? ` (${reasons.join("; ")})` : ""} — press Prepare again to retry.</span>}
        </div>
      )}
      {unsupported > 0 && (
        <div className="mt-1.5 text-[13px] text-muted">
          {unsupported} {unsupported === 1 ? "photo uses" : "photos use"} an address that isn&apos;t a web link (an old local file), so no thumbnail can be made — re-upload {unsupported === 1 ? "it" : "them"} to fix.
        </div>
      )}
      {error && (
        <div role="alert" className="mt-1.5 text-[13px] text-error">
          {error}
        </div>
      )}
    </div>
  );
}
