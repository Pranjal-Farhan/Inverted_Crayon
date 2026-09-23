"use client";

import { useState, useTransition } from "react";
import { saveAddress, deleteAddress } from "@/actions/customer-profile";

type Address = {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  area: string;
  district: string;
  postcode: string;
  country: string;
  isDefault: boolean;
};

export function AddressManager({ addresses }: { addresses: Address[] }) {
  const [editing, setEditing] = useState<Address | "new" | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      {addresses.map((a) => (
        <div key={a.id} className="mb-2.5 flex items-center justify-between border border-line bg-panel p-3.5 text-sm">
          <div>
            <span className="font-medium">{a.fullName}</span> {a.isDefault && <span className="text-lime">· default</span>}
            <br />
            <span className="text-muted">
              {a.line1}, {a.area}, {a.district} {a.postcode}
            </span>
          </div>
          <div className="flex gap-2.5">
            <button onClick={() => setEditing(a)} className="text-cyan text-[13px] hover:underline">
              Edit
            </button>
            <button
              onClick={() => startTransition(() => deleteAddress(a.id))}
              className="text-[13px] text-error hover:underline"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
      {addresses.length === 0 && <p className="mb-3 text-sm text-muted">No saved addresses yet.</p>}

      <button onClick={() => setEditing("new")} className="border border-line-2 px-3.5 py-2 text-sm hover:border-lime">
        + Add address
      </button>

      {editing && (
        <AddressForm
          address={editing === "new" ? null : editing}
          pending={pending}
          onCancel={() => setEditing(null)}
          onSave={(data) => startTransition(async () => { await saveAddress(data); setEditing(null); })}
        />
      )}
    </div>
  );
}

function AddressForm({
  address,
  pending,
  onCancel,
  onSave,
}: {
  address: Address | null;
  pending: boolean;
  onCancel: () => void;
  onSave: (data: Omit<Address, "id"> & { id?: string }) => void;
}) {
  const [fullName, setFullName] = useState(address?.fullName ?? "");
  const [phone, setPhone] = useState(address?.phone ?? "");
  const [line1, setLine1] = useState(address?.line1 ?? "");
  const [area, setArea] = useState(address?.area ?? "");
  const [district, setDistrict] = useState(address?.district ?? "");
  const [postcode, setPostcode] = useState(address?.postcode ?? "");
  const [country, setCountry] = useState(address?.country ?? "Bangladesh");
  const [isDefault, setIsDefault] = useState(address?.isDefault ?? false);

  return (
    <div className="mt-3.5 border border-line bg-panel-2 p-4">
      <div className="grid grid-cols-1 gap-2.5 desktop:grid-cols-2">
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" className="border border-line-2 bg-ink px-2.5 py-1.5 text-sm" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="border border-line-2 bg-ink px-2.5 py-1.5 text-sm" />
      </div>
      <input value={line1} onChange={(e) => setLine1(e.target.value)} placeholder="Address" className="mt-2.5 w-full border border-line-2 bg-ink px-2.5 py-1.5 text-sm" />
      <div className="mt-2.5 grid grid-cols-1 gap-2.5 desktop:grid-cols-3">
        <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Area" className="border border-line-2 bg-ink px-2.5 py-1.5 text-sm" />
        <input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="District" className="border border-line-2 bg-ink px-2.5 py-1.5 text-sm" />
        <input value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="Postcode" className="border border-line-2 bg-ink px-2.5 py-1.5 text-sm" />
      </div>
      <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" className="mt-2.5 w-full border border-line-2 bg-ink px-2.5 py-1.5 text-sm" />
      <label className="mt-2.5 flex items-center gap-1.5 text-sm">
        <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} /> Set as default
      </label>
      <div className="mt-3 flex gap-2">
        <button
          disabled={pending}
          onClick={() => onSave({ id: address?.id, fullName, phone, line1, area, district, postcode, country, isDefault })}
          className="btn-primary bg-lime px-3.5 py-1.5 font-impact text-sm text-ink disabled:opacity-50"
        >
          Save
        </button>
        <button onClick={onCancel} className="border border-line-2 px-3.5 py-1.5 text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
}
