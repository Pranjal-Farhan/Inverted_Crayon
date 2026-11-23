"use client";

import { useState } from "react";
import { prepareThumbnails } from "@/actions/admin-thumbs";

/**
 * "Prepare photo thumbnails": photos uploaded before thumbnails existed have none, so the hover wheel
 * has to make each one the first time it is asked for (slow — it downloads the full-size original).
 * This makes them all now, a batch at a time, with a running count. Only shown while some are missing.
 */
export function PrepareThumbsButton({ missing }: { missing: number }) {
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [left, setLeft] = useState(missing);
  const [made, setMade] = useState(0);
  const [stuck, setStuck] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setPhase("running");
    setError(null);
    let skip: string[] = [];
    let total = 0;
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
      total += r.made;
      setMade(total);
      setLeft(r.remaining);
      setStuck(skip.length);
      if (r.remaining === 0 || r.made === 0) break;
    }
    setPhase("done");
  }

  // `left` leaves out photos that failed during this run, so add them back for the headline: it should
  // say what's still without a thumbnail, which is what the page will show on the next visit too.
  const outstanding = left + stuck;
  const finished = phase === "done" && !error && outstanding === 0;

  return (
    <div className="mb-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 border border-line bg-panel px-4 py-3 text-sm">
      <div className="min-w-0 flex-1">
        <span className="font-medium">
          {finished ? "All photos have a small thumbnail now." : `${outstanding} ${outstanding === 1 ? "photo has" : "photos have"} no small thumbnail yet.`}
        </span>{" "}
        {!finished && (
          <span className="text-muted">
            The hover wheel on the shop fills its circles slowly for these the first time. Preparing them now makes it instant.
          </span>
        )}
        {phase === "running" && <div className="mt-1 text-[13px] text-lime">Preparing… {made} done, {left} to go (keep this page open)</div>}
        {phase === "done" && !error && (
          <div className="mt-1 text-[13px] text-lime">
            Made {made}.{stuck > 0 && <span className="text-yellow"> {stuck} couldn&apos;t be prepared — the image host didn&apos;t answer for them.</span>}
          </div>
        )}
        {error && (
          <div role="alert" className="mt-1 text-[13px] text-error">
            {error}
          </div>
        )}
      </div>
      {!finished && (
        <button
          type="button"
          onClick={run}
          disabled={phase === "running"}
          className="border border-line-2 px-3.5 py-2 text-sm hover:border-lime disabled:opacity-50"
        >
          {phase === "running" ? "Preparing…" : "Prepare photo thumbnails"}
        </button>
      )}
    </div>
  );
}
