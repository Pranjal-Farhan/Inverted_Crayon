"use client";

import { useState, useTransition } from "react";
import { saveCollection, deleteCollection } from "@/actions/admin-collections";
import { Panel } from "@/components/admin/Panel";
import { StatusBadge } from "@/components/admin/StatusBadge";

type Collection = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  heroCopy: string | null;
  active: boolean;
  _count: { products: number };
};

export function CollectionManager({ collections }: { collections: Collection[] }) {
  const [editing, setEditing] = useState<Collection | "new" | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Panel title="Collections">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line-2 text-left text-muted">
            {["Collection", "Products", "Status", ""].map((h) => (
              <th key={h} className="font-label pb-2 text-[13px] tracking-[0.8px]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {collections.map((c) => (
            <tr key={c.id} className="border-b border-line">
              <td className="py-2">{c.title}</td>
              <td className="py-2">{c._count.products} products</td>
              <td className="py-2">
                <StatusBadge status={c.active ? "Active" : "Scheduled"} />
              </td>
              <td className="py-2 text-right">
                <button onClick={() => setEditing(c)} className="text-cyan text-[13px] hover:underline">
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
      <button onClick={() => setEditing("new")} className="mt-3 border border-line-2 px-3 py-1.5 text-[13px] hover:border-lime">
        + New collection
      </button>

      {editing && (
        <CollectionForm
          collection={editing === "new" ? null : editing}
          pending={pending}
          onCancel={() => setEditing(null)}
          onSave={(data) =>
            startTransition(async () => {
              await saveCollection(data);
              setEditing(null);
            })
          }
          onDelete={
            editing !== "new"
              ? () =>
                  startTransition(async () => {
                    await deleteCollection(editing.id);
                    setEditing(null);
                  })
              : undefined
          }
        />
      )}
    </Panel>
  );
}

function CollectionForm({
  collection,
  pending,
  onCancel,
  onSave,
  onDelete,
}: {
  collection: Collection | null;
  pending: boolean;
  onCancel: () => void;
  onSave: (data: { id?: string; title: string; slug: string; description?: string; heroCopy?: string; active: boolean }) => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(collection?.title ?? "");
  const [slug, setSlug] = useState(collection?.slug ?? "");
  const [description, setDescription] = useState(collection?.description ?? "");
  const [heroCopy, setHeroCopy] = useState(collection?.heroCopy ?? "");
  const [active, setActive] = useState(collection?.active ?? true);

  return (
    <div className="mt-3.5 border border-line bg-panel-2 p-4">
      <div className="grid grid-cols-1 gap-2.5 desktop:grid-cols-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="border border-line-2 bg-ink px-2.5 py-1.5 text-sm" />
        <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug" className="border border-line-2 bg-ink px-2.5 py-1.5 text-sm" />
      </div>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
        rows={2}
        className="mt-2.5 w-full border border-line-2 bg-ink px-2.5 py-1.5 text-sm"
      />
      <input
        value={heroCopy}
        onChange={(e) => setHeroCopy(e.target.value)}
        placeholder="Hero copy"
        className="mt-2.5 w-full border border-line-2 bg-ink px-2.5 py-1.5 text-sm"
      />
      <label className="mt-2.5 flex items-center gap-1.5 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
      </label>
      <div className="mt-3 flex gap-2">
        <button
          disabled={pending}
          onClick={() => onSave({ id: collection?.id, title, slug, description, heroCopy, active })}
          className="btn-primary bg-lime px-3.5 py-1.5 font-impact text-sm text-ink disabled:opacity-50"
        >
          Save
        </button>
        <button onClick={onCancel} className="border border-line-2 px-3.5 py-1.5 text-sm">
          Cancel
        </button>
        {onDelete && (
          <button onClick={onDelete} className="ml-auto text-sm text-error hover:underline">
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
