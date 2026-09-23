"use client";

import { useState, useTransition } from "react";
import { inviteStaff, updateStaffRole, removeStaff } from "@/actions/admin-staff";
import { Panel } from "@/components/admin/Panel";

type StaffUser = { id: string; email: string; name: string; role: "ADMIN" | "STAFF" };

export function StaffManager({ users, selfId }: { users: StaffUser[]; selfId: string }) {
  const [pending, startTransition] = useTransition();
  const [inviting, setInviting] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "STAFF">("STAFF");
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  return (
    <Panel title="Staff roles">
      <p className="mb-3 text-[13px] text-muted">Admin — full access · Staff — fulfil orders, no refunds or settings.</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line-2 text-left text-muted">
            {["Name", "Email", "Role", ""].map((h) => (
              <th key={h} className="font-label pb-2 text-[13px] tracking-[0.8px]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-line">
              <td className="py-2">
                {u.name} {u.id === selfId && <span className="text-muted">(you)</span>}
              </td>
              <td className="py-2">{u.email}</td>
              <td className="py-2">
                <select
                  value={u.role}
                  disabled={pending || u.id === selfId}
                  onChange={(e) => {
                    setActionError(null);
                    startTransition(async () => {
                      try {
                        await updateStaffRole(u.id, e.target.value as "ADMIN" | "STAFF");
                      } catch (err) {
                        setActionError(err instanceof Error ? err.message : "Couldn't update role.");
                      }
                    });
                  }}
                  className="border border-line-2 bg-ink px-2 py-1 text-sm disabled:opacity-50"
                >
                  <option value="ADMIN">Admin</option>
                  <option value="STAFF">Staff</option>
                </select>
              </td>
              <td className="py-2 text-right">
                {u.id !== selfId && (
                  <button
                    disabled={pending}
                    onClick={() => {
                      setActionError(null);
                      if (!confirm(`Remove ${u.name}?`)) return;
                      startTransition(async () => {
                        try {
                          await removeStaff(u.id);
                        } catch (err) {
                          setActionError(err instanceof Error ? err.message : "Couldn't remove.");
                        }
                      });
                    }}
                    className="text-[13px] text-error hover:underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {actionError && <p className="mt-2 text-[13px] text-error">{actionError}</p>}

      {!inviting ? (
        <button onClick={() => setInviting(true)} className="mt-3 border border-line-2 px-3.5 py-2 text-sm hover:border-lime">
          + Invite staff
        </button>
      ) : (
        <div className="mt-3.5 border border-line bg-panel-2 p-4">
          <div className="grid gap-2.5 desktop:grid-cols-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="border border-line-2 bg-ink px-2.5 py-1.5 text-sm" />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="border border-line-2 bg-ink px-2.5 py-1.5 text-sm" />
          </div>
          <div className="mt-2.5 grid gap-2.5 desktop:grid-cols-2">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Temporary password"
              type="password"
              className="border border-line-2 bg-ink px-2.5 py-1.5 text-sm"
            />
            <select value={role} onChange={(e) => setRole(e.target.value as typeof role)} className="border border-line-2 bg-ink px-2.5 py-1.5 text-sm">
              <option value="STAFF">Staff</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          {error && <p className="mt-2 text-[13px] text-error">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const res = await inviteStaff({ name, email, password, role });
                  if (!res.ok) {
                    setError(res.error);
                    return;
                  }
                  setInviting(false);
                  setName("");
                  setEmail("");
                  setPassword("");
                })
              }
              className="btn-primary bg-lime px-3.5 py-1.5 font-impact text-sm text-ink disabled:opacity-50"
            >
              Create
            </button>
            <button onClick={() => setInviting(false)} className="border border-line-2 px-3.5 py-1.5 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
}
