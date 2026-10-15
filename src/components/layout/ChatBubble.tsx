"use client";

import { useEffect, useRef, useState } from "react";
import { CrayonScribble } from "@/components/brand/CrayonScribble";

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-[22px] w-[22px]" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.77.46 3.43 1.28 4.87L2 22l5.33-1.4a9.9 9.9 0 0 0 4.71 1.2h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2zm0 18.02h-.01a8.1 8.1 0 0 1-4.14-1.13l-.3-.18-3.16.83.84-3.08-.19-.31a8.1 8.1 0 0 1-1.24-4.32c0-4.48 3.65-8.13 8.14-8.13 2.17 0 4.21.85 5.75 2.39a8.07 8.07 0 0 1 2.38 5.75c0 4.48-3.65 8.14-8.13 8.14z" />
    </svg>
  );
}

function MessengerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-[22px] w-[22px]" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.15 2 11.27c0 2.9 1.44 5.49 3.7 7.19V22l3.38-1.86c.9.25 1.87.38 2.88.38 5.52 0 10-4.15 10-9.27C21.96 6.15 17.48 2 12 2zm1.02 12.48-2.55-2.72-4.98 2.72 5.48-5.8 2.61 2.72 4.92-2.72-5.48 5.8z" />
    </svg>
  );
}

/** A hand-drawn speech bubble with three crayon dots — the launcher's resting icon. */
function BubbleIcon() {
  return (
    <svg viewBox="0 0 32 32" className="h-[30px] w-[30px]" aria-hidden="true">
      <path
        d="M5 6.5 Q5 4 7.5 4 L24.5 4 Q27 4 27 6.5 L27 19.5 Q27 22 24.5 22 L14 22 L8.5 27.5 L8.5 22 L7.5 22 Q5 22 5 19.5 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="11" cy="13" r="1.9" fill="#c3f53a" />
      <circle cx="16" cy="13" r="1.9" fill="#ff2d84" />
      <circle cx="21" cy="13" r="1.9" fill="#26a7e6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 32 32" className="h-[26px] w-[26px]" aria-hidden="true">
      <path d="M8 8 L24 24 M24 8 L8 24" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

type Channel = { href: string; name: string; hint: string; tile: string; icon: React.ReactNode };

export function ChatBubble({
  whatsappUrl,
  messengerUrl,
}: {
  whatsappUrl: string | null;
  messengerUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on Escape, or when anything outside the bubble is pressed.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onPointer(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const channels: Channel[] = [];
  if (whatsappUrl) {
    channels.push({
      href: whatsappUrl,
      name: "WhatsApp",
      hint: "Message us on WhatsApp",
      tile: "bg-[#25D366] text-ink",
      icon: <WhatsAppIcon />,
    });
  }
  if (messengerUrl) {
    channels.push({
      href: messengerUrl,
      name: "Messenger",
      hint: "Message us on Messenger",
      tile: "bg-[#0084FF] text-paper",
      icon: <MessengerIcon />,
    });
  }

  if (channels.length === 0) return null;

  return (
    <div
      ref={rootRef}
      className="fixed right-4 z-[150] flex flex-col items-end gap-3.5 desktop:right-6"
      style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      {open && (
        <div
          id="chat-panel"
          role="dialog"
          aria-label="Chat with us"
          className="chat-pop relative w-[min(300px,calc(100vw-2rem))] overflow-hidden border border-line-2 border-t-[5px] border-t-lime bg-panel shadow-[0_18px_50px_rgba(0,0,0,.55)]"
        >
          {/* decorative crayon fan tucked into the corner, behind the text */}
          <CrayonScribble
            id="chat"
            color="var(--color-ic-pink)"
            strokeCount={4}
            className="pointer-events-none absolute -right-3 -top-2 h-[78px] w-[100px] opacity-[0.28]"
          />
          <div className="relative px-4 pb-3 pt-3.5">
            <p className="font-scrawl text-[15px] leading-none text-pink">Got a question?</p>
            <h2 className="mt-1.5 font-impact text-[26px] uppercase leading-[0.95] tracking-[0.5px]">
              Chat with <span className="text-lime">us</span>
            </h2>
            <p className="mt-1.5 text-[13px] leading-snug text-muted">Pick an app — we&apos;ll take it from there.</p>
          </div>
          <div className="relative flex flex-col gap-2 px-3 pb-3.5">
            {channels.map((c) => (
              <a
                key={c.name}
                href={c.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="group flex items-center gap-3 border border-line-2 bg-ink px-3 py-2.5 hover:-translate-y-0.5 hover:border-lime hover:bg-[#101012]"
              >
                <span className={`grid h-10 w-10 shrink-0 place-items-center ${c.tile}`}>{c.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-label block text-[19px] uppercase leading-none tracking-[1.2px]">{c.name}</span>
                  <span className="mt-1 block truncate text-[12px] text-muted">{c.hint}</span>
                </span>
                <span
                  aria-hidden
                  className="font-impact text-lg leading-none text-muted-2 transition group-hover:translate-x-0.5 group-hover:text-lime"
                >
                  →
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="group relative">
        {/* little marker-pen label that slides out beside the button on desktop hover/focus */}
        {!open && (
          <span
            aria-hidden
            className="font-scrawl pointer-events-none absolute right-[calc(100%+12px)] top-1/2 hidden -translate-y-1/2 -rotate-2 whitespace-nowrap border border-line-2 bg-ink px-3 py-1.5 text-[15px] text-pink opacity-0 transition duration-200 group-hover:opacity-100 group-focus-within:opacity-100 desktop:block"
          >
            Talk to us!
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close chat options" : "Chat with us"}
          aria-expanded={open}
          aria-controls="chat-panel"
          className={`btn-primary relative grid h-[58px] w-[58px] place-items-center text-ink shadow-[4px_4px_0_#ff2d84] hover:shadow-[6px_6px_0_#ff2d84] ${
            open ? "bg-paper" : "bg-lime hover:bg-[#d3ff4f]"
          }`}
        >
          {/* a few slow rings on first load so the button gets noticed, then it settles */}
          {!open && <span aria-hidden className="chat-ring pointer-events-none absolute inset-0 border-2 border-lime" />}
          {open ? <CloseIcon /> : <BubbleIcon />}
        </button>
      </div>
    </div>
  );
}
