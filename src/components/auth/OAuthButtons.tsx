export function OAuthButtons({ intent }: { intent: "customer" | "admin" }) {
  return (
    <div className="mb-4">
      <div className="flex flex-col gap-2">
        <a
          href={`/api/auth/google/start?intent=${intent}`}
          className="flex items-center justify-center gap-2.5 border border-line-2 py-2.5 text-sm font-medium transition-colors hover:border-lime hover:text-lime"
        >
          <GoogleIcon className="h-[18px] w-[18px]" /> Continue with Google
        </a>
      </div>
      <div className="my-4 flex items-center gap-3 text-[11px] tracking-[1px] text-muted-2">
        <span className="h-px flex-1 bg-line" /> OR <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}

export function OAuthErrorBanner({ code }: { code: string | null }) {
  if (!code) return null;
  const messages: Record<string, string> = {
    not_configured: "That sign-in method isn't set up yet — use email and password.",
    no_account: "No staff account exists for that email yet — ask an admin to create one first.",
    error: "That sign-in attempt didn't go through. Please try again.",
  };
  const message = messages[code];
  if (!message) return null;
  return <p className="mb-3 border border-error/40 bg-error/[0.08] px-3 py-2 text-[13px] text-error">{message}</p>;
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path fill="#4285F4" d="M23.5 12.3c0-.85-.08-1.66-.22-2.44H12v4.62h6.46a5.53 5.53 0 01-2.4 3.63v3h3.87c2.27-2.09 3.57-5.17 3.57-8.81z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.87-3c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.1A12 12 0 0012 24z" />
      <path fill="#FBBC05" d="M5.27 14.29a7.2 7.2 0 010-4.58v-3.1H1.27a12 12 0 000 10.78z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.27 6.61l4 3.1C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  );
}

