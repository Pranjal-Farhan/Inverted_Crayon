"use client";

import { useState, useTransition } from "react";
import { saveCampaign, deleteCampaign } from "@/actions/admin-campaigns";
import { StatusBadge } from "@/components/admin/StatusBadge";

type Campaign = {
  id: string;
  name: string;
  percentOff: number | null;
  targetCategoryId: string | null;
  targetCategoryName: string | null;
  startsAt: string;
  endsAt: string;
  active: boolean;
};

function statusFor(c: Campaign): string {
  const now = new Date();
  if (!c.active) return "Draft";
  if (new Date(c.startsAt) > now) return "Scheduled";
  if (new Date(c.endsAt) < now) return "Draft";
  return "Active";
}

export function CampaignManager({
  campaigns,
  categories,
}: {
  campaigns: Campaign[];
  categories: { id: string; name: string }[];
}) {
  const [editing, setEditing] = useState<Campaign | "new" | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <div className="mb-3.5 flex justify-end">
        <button onClick={() => setEditing("new")} className="btn-primary bg-lime px-4 py-2 font-impact text-sm text-ink">
          + New campaign
        </button>
      </div>
      <div className="border border-line bg-panel">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line-2 text-left text-muted">
              {["Campaign", "Target", "Discount", "Window", "Status", ""].map((h) => (
                <th key={h} className="font-label px-4 py-2.5 text-[13px] tracking-[0.8px]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="border-b border-line">
                <td className="px-4 py-2.5">{c.name}</td>
                <td className="px-4 py-2.5">{c.targetCategoryName ?? "Selected products"}</td>
                <td className="px-4 py-2.5">{c.percentOff}% off</td>
                <td className="px-4 py-2.5">
                  {new Date(c.startsAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}–
                  {new Date(c.endsAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={statusFor(c)} />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => setEditing(c)} className="text-cyan text-[13px] hover:underline">
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {campaigns.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  No campaigns yet.
                </td>
              </tr>
            )}
          </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <CampaignForm
          campaign={editing === "new" ? null : editing}
          categories={categories}
          pending={pending}
          onCancel={() => setEditing(null)}
          onSave={(data) => startTransition(async () => { await saveCampaign(data); setEditing(null); })}
          onDelete={editing !== "new" ? () => startTransition(async () => { await deleteCampaign(editing.id); setEditing(null); }) : undefined}
        />
      )}
    </div>
  );
}

function toLocalInput(iso: string): string {
  return new Date(iso).toISOString().slice(0, 16);
}

function CampaignForm({
  campaign,
  categories,
  pending,
  onCancel,
  onSave,
  onDelete,
}: {
  campaign: Campaign | null;
  categories: { id: string; name: string }[];
  pending: boolean;
  onCancel: () => void;
  onSave: (data: {
    id?: string;
    name: string;
    percentOff: number | null;
    targetCategoryId: string | null;
    startsAt: string;
    endsAt: string;
    active: boolean;
  }) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(campaign?.name ?? "");
  const [percentOff, setPercentOff] = useState(campaign?.percentOff ?? 20);
  const [targetCategoryId, setTargetCategoryId] = useState(campaign?.targetCategoryId ?? "");
  const [startsAt, setStartsAt] = useState(() =>
    campaign ? toLocalInput(campaign.startsAt) : new Date().toISOString().slice(0, 16),
  );
  const [endsAt, setEndsAt] = useState(() =>
    campaign ? toLocalInput(campaign.endsAt) : new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
  );
  const [active, setActive] = useState(campaign?.active ?? true);

  return (
    <div className="mt-3.5 border border-line bg-panel-2 p-4">
      <div className="grid grid-cols-1 gap-2.5 desktop:grid-cols-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Campaign name" className="border border-line-2 bg-ink px-2.5 py-1.5 text-sm" />
        <select value={targetCategoryId} onChange={(e) => setTargetCategoryId(e.target.value)} className="border border-line-2 bg-ink px-2.5 py-1.5 text-sm">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input type="number" value={percentOff} onChange={(e) => setPercentOff(Number(e.target.value))} placeholder="% off" className="border border-line-2 bg-ink px-2.5 py-1.5 text-sm" />
      </div>
      <div className="mt-2.5 grid grid-cols-1 gap-2.5 desktop:grid-cols-2">
        <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="border border-line-2 bg-ink px-2.5 py-1.5 text-sm" />
        <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="border border-line-2 bg-ink px-2.5 py-1.5 text-sm" />
      </div>
      <label className="mt-2.5 flex items-center gap-1.5 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
      </label>
      <div className="mt-3 flex gap-2">
        <button
          disabled={pending}
          onClick={() =>
            onSave({
              id: campaign?.id,
              name,
              percentOff,
              targetCategoryId: targetCategoryId || null,
              startsAt: new Date(startsAt).toISOString(),
              endsAt: new Date(endsAt).toISOString(),
              active,
            })
          }
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
