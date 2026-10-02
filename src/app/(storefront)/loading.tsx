import { Skeleton } from "@/components/ui/Skeleton";

/** Generic storefront fallback — Next.js shows this for any page in this route group while
 * its Server Component data is still fetching. Shaped like the common case (a heading block
 * over a product grid) so it reads naturally on the homepage, PLPs, and gender hubs alike;
 * less exact on one-off pages like checkout, but still masks the same fetch delay there. */
export default function StorefrontLoading() {
  return (
    <section className="pg pb-16">
      <div className="pt-8 pb-1.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-3 h-14 w-[70%] max-w-[520px]" />
        <Skeleton className="mt-3 h-4 w-[60%] max-w-[380px]" />
      </div>
      <div className="mt-8 grid grid-cols-2 gap-5 desktop:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="aspect-[1/1.16] w-full" />
            <Skeleton className="mt-2.5 h-3 w-3/4" />
            <Skeleton className="mt-1.5 h-3.5 w-1/2" />
          </div>
        ))}
      </div>
    </section>
  );
}
