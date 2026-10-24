"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Monogram } from "@/components/brand/Monogram";

/**
 * What a visitor sees instead of a bare "server error" when a page can't be built — almost always
 * because the database was asleep and is still waking up. It says so in plain words, retries by
 * itself (after 3, 5, 8, 12 and 20 seconds) and only then hands the decision back with a button.
 *
 * Each failed retry makes the error boundary remount this component, which would restart the
 * schedule from zero; the number of automatic tries so far therefore lives outside React, and is
 * forgotten once nothing has been tried for a couple of minutes.
 */

const WAITS = [3, 5, 8, 12, 20];
const FORGET_AFTER_MS = 120_000;
/** If a retry neither succeeds nor fails within this long, stop showing "trying…" and offer the button again. */
const GIVE_UP_WAITING_MS = 45_000;

const memory = { tries: 0, lastTryAt: 0 };
const triesSoFar = () => (Date.now() - memory.lastTryAt > FORGET_AFTER_MS ? 0 : memory.tries);

type Variant = "page" | "inline" | "admin";

export function RetryPanel({ retry, digest, variant }: { retry: () => void; digest?: string; variant: Variant }) {
  const [tries] = useState(triesSoFar);
  const exhausted = tries >= WAITS.length;
  const [secondsLeft, setSecondsLeft] = useState<number | null>(exhausted ? null : WAITS[tries]);
  const [trying, setTrying] = useState(false);

  function tryNow(automatic: boolean) {
    memory.tries = automatic ? tries + 1 : memory.tries;
    memory.lastTryAt = Date.now();
    setTrying(true);
    setSecondsLeft(null);
    retry();
    setTimeout(() => setTrying(false), GIVE_UP_WAITING_MS);
  }

  useEffect(() => {
    if (secondsLeft === null || trying) return;
    const t = setTimeout(() => {
      if (secondsLeft <= 1) tryNow(true);
      else setSecondsLeft(secondsLeft - 1);
    }, 1000);
    return () => clearTimeout(t);
    // tryNow only reads values that are fixed for this mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, trying]);

  // The admin shell can fail as a whole (it checks the session in the database), landing on the root boundary.
  const pathname = usePathname();
  const admin = variant === "admin" || pathname.startsWith("/admin");
  const wait = !exhausted ? WAITS[tries] : 0;

  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 px-5 text-center text-paper ${
        variant === "page" ? "min-h-screen bg-ink" : variant === "inline" ? "py-24" : "py-20"
      }`}
    >
      <Monogram className="h-11 w-14" />
      <h1 className="font-impact text-[clamp(34px,7vw,64px)] uppercase leading-[0.95] text-lime">
        {exhausted ? "Still waking up" : "Warming up…"}
      </h1>
      <p className="font-scrawl text-xl text-yellow">
        {admin ? "The database is taking a moment." : "Even crayons need a second to wake up."}
      </p>
      <p className="max-w-[460px] text-sm leading-relaxed text-muted">
        {exhausted
          ? "This is taking longer than usual — it's not something you did. Give it a minute, then try again."
          : admin
            ? "The database was quiet for a while and is coming back, or briefly couldn't be reached. Nothing is lost. We'll keep retrying for you."
            : "The shop was quiet for a while and is getting back on its feet. This normally takes just a few seconds — we'll try again for you."}
      </p>

      <div role="status" aria-live="polite" className="w-full max-w-[320px]">
        {trying ? (
          <p className="text-sm text-paper">Trying again…</p>
        ) : secondsLeft !== null ? (
          <>
            <p className="text-sm text-paper">Trying again in {secondsLeft}s</p>
            <div className="mt-2 h-1 w-full overflow-hidden bg-line-2" aria-hidden>
              <div className="h-full bg-lime transition-[width] duration-1000 ease-linear" style={{ width: `${wait > 0 ? ((wait - secondsLeft) / wait) * 100 : 100}%` }} />
            </div>
          </>
        ) : null}
      </div>

      <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          disabled={trying}
          onClick={() => tryNow(false)}
          className="btn-primary inline-flex items-center gap-3 bg-lime px-6 py-3 font-impact text-ink disabled:opacity-60"
        >
          {trying ? "Trying…" : exhausted ? "Try again" : "Try again now"}
        </button>
        {variant === "page" && !admin && (
          <Link href="/" className="border border-line-2 px-6 py-3 font-impact text-paper hover:border-lime">
            Back home
          </Link>
        )}
      </div>

      {digest && <p className="mt-2 font-mono text-[11px] text-muted-2">Reference {digest}</p>}
    </div>
  );
}
