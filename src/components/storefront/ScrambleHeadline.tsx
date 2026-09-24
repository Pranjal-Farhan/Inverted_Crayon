"use client";

import { useEffect, useState } from "react";

const NOISE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&*+";
const TOTAL_FRAMES = 22;
const FRAME_MS = 40;

function scrambleFrame(target: string, revealCount: number): string {
  let out = "";
  for (let i = 0; i < target.length; i++) {
    if (target[i] === " ") {
      out += " ";
    } else if (i < revealCount) {
      out += target[i];
    } else {
      out += NOISE_CHARS[Math.floor(Math.random() * NOISE_CHARS.length)];
    }
  }
  return out;
}

/**
 * Decode-in text scramble for the homepage hero headline, on mount only. Renders the real
 * text on first paint (SSR + before hydration, and for anything that doesn't run the effect)
 * — the scramble is a brief flourish layered on top, never the only copy of the words.
 */
export function ScrambleHeadline({ first, rest }: { first: string; rest: string }) {
  const [displayFirst, setDisplayFirst] = useState(first);
  const [displayRest, setDisplayRest] = useState(rest);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const timer = setInterval(() => {
      const revealFirst = Math.floor((frame / TOTAL_FRAMES) * first.length);
      const revealRest = Math.floor((frame / TOTAL_FRAMES) * rest.length);
      setDisplayFirst(scrambleFrame(first, revealFirst));
      setDisplayRest(scrambleFrame(rest, revealRest));
      frame++;
      if (frame > TOTAL_FRAMES) {
        clearInterval(timer);
        setDisplayFirst(first);
        setDisplayRest(rest);
      }
    }, FRAME_MS);
    return () => clearInterval(timer);
    // Runs once on mount for the initial headline — first/rest come from CMS content that
    // doesn't change without a full page reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {displayFirst} <span className="text-lime">{displayRest}</span>
    </>
  );
}
