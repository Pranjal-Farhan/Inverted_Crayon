import Link from "next/link";
import { db } from "@/lib/db";
import { Panel } from "@/components/admin/Panel";
import { StatusBadge } from "@/components/admin/StatusBadge";

export default async function AdminJournalPage() {
  const posts = await db.post.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <div className="mb-3.5 flex justify-end">
        <Link href="/admin/journal/new" className="btn-primary bg-lime px-4 py-2 font-impact text-sm text-ink">
          + New post
        </Link>
      </div>
      <Panel className="!p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line-2 text-left text-muted">
              {["Title", "Author", "Status", "Published", ""].map((h) => (
                <th key={h} className="font-label px-4 py-2.5 text-[13px] tracking-[0.8px]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id} className="border-b border-line">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/journal/${p.id}`} className="hover:text-lime">
                    {p.title}
                  </Link>
                </td>
                <td className="px-4 py-2.5">{p.authorName}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={p.status === "PUBLISHED" ? "Active" : "Draft"} />
                </td>
                <td className="px-4 py-2.5">
                  {p.publishedAt ? p.publishedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—"}
                </td>
              </tr>
            ))}
            {posts.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted">
                  No posts yet.
                </td>
              </tr>
            )}
          </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
