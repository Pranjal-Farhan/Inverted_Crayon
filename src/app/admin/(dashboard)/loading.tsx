import { Skeleton } from "@/components/ui/Skeleton";

/** Generic admin fallback — renders inside the persistent sidebar/topbar chrome (the layout
 * itself never unmounts) while a dashboard page's own data is still fetching. Shaped like the
 * common case (a title bar over a panel of rows), not any one page exactly, but it masks the
 * same fetch delay everywhere under /admin/(dashboard). */
export default function AdminLoading() {
  return (
    <div>
      <Skeleton className="h-6 w-40" />
      <div className="mt-4.5 border border-line bg-panel p-4.5">
        <Skeleton className="h-4 w-28" />
        <div className="mt-3.5 flex flex-col gap-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
