import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <div className="font-impact text-[clamp(80px,18vw,180px)] leading-[0.8] text-lime">404</div>
      <p className="font-scrawl mt-2 text-xl text-yellow">This page never fit in either.</p>
      <Button href="/" className="mt-4">
        Back home
      </Button>
    </div>
  );
}
