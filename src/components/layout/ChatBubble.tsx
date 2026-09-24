"use client";

import { useState } from "react";

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.77.46 3.43 1.28 4.87L2 22l5.33-1.4a9.9 9.9 0 0 0 4.71 1.2h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2zm0 18.02h-.01a8.1 8.1 0 0 1-4.14-1.13l-.3-.18-3.16.83.84-3.08-.19-.31a8.1 8.1 0 0 1-1.24-4.32c0-4.48 3.65-8.13 8.14-8.13 2.17 0 4.21.85 5.75 2.39a8.07 8.07 0 0 1 2.38 5.75c0 4.48-3.65 8.14-8.13 8.14z" />
    </svg>
  );
}

function MessengerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.15 2 11.27c0 2.9 1.44 5.49 3.7 7.19V22l3.38-1.86c.9.25 1.87.38 2.88.38 5.52 0 10-4.15 10-9.27C21.96 6.15 17.48 2 12 2zm1.02 12.48-2.55-2.72-4.98 2.72 5.48-5.8 2.61 2.72 4.92-2.72-5.48 5.8z" />
    </svg>
  );
}

export function ChatBubble({
  whatsappUrl,
  messengerUrl,
}: {
  whatsappUrl: string | null;
  messengerUrl: string | null;
}) {
  const [open, setOpen] = useState(false);

  if (!whatsappUrl && !messengerUrl) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[150] flex flex-col items-end gap-3">
      {open && (
        <div className="flex flex-col gap-2 border border-line bg-panel p-2.5 shadow-[0_10px_30px_rgba(0,0,0,.4)]">
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-paper hover:bg-[#141416]"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#25D366] text-ink">
                <WhatsAppIcon />
              </span>
              WhatsApp
            </a>
          )}
          {messengerUrl && (
            <a
              href={messengerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-paper hover:bg-[#141416]"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#0084FF] text-paper">
                <MessengerIcon />
              </span>
              Messenger
            </a>
          )}
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close chat options" : "Chat with us"}
        aria-expanded={open}
        className="btn-primary grid h-14 w-14 place-items-center rounded-full bg-lime text-ink shadow-[0_10px_30px_rgba(0,0,0,.4)] transition hover:bg-[#d3ff4f]"
      >
        {open ? (
          <span aria-hidden className="text-2xl leading-none">
            ×
          </span>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6" aria-hidden="true">
            <path d="M12 2C6.48 2 2 5.98 2 10.8c0 2.76 1.47 5.22 3.77 6.83-.13 1-.5 2.4-1.44 3.86a.5.5 0 0 0 .58.75c2.09-.6 3.7-1.5 4.68-2.16.75.14 1.54.22 2.41.22 5.52 0 10-3.98 10-8.8S17.52 2 12 2z" />
          </svg>
        )}
      </button>
    </div>
  );
}
