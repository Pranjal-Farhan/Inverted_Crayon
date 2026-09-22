import Link from "next/link";
import { Monogram } from "@/components/brand/Monogram";

export default function RootNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink text-center text-paper">
      <Monogram className="h-11 w-14" />
      <div className="font-impact text-[clamp(80px,18vw,180px)] leading-[0.8] text-lime">404</div>
      <p className="font-scrawl text-xl text-yellow">This page never fit in either.</p>
      <Link href="/" className="btn-primary mt-2 inline-flex items-center gap-3 bg-lime px-6 py-3 font-impact text-ink">
        Back home →
      </Link>
    </div>
  );
}
