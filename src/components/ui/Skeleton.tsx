/** A single shimmering placeholder block — compose a few into a page-shaped loading.tsx. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton ${className}`} />;
}
