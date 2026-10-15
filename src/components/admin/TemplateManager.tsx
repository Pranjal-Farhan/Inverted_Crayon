"use client";

import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { resetMessageTemplate, saveMessageTemplate } from "@/actions/admin-templates";
import {
  MAX_BODY_LENGTH,
  PLACEHOLDERS,
  SAMPLE_VALUES,
  TEMPLATES,
  findUnknownPlaceholders,
  renderTemplate,
  type TemplateDef,
  type TemplateKey,
} from "@/lib/message-templates";

type Config = { body: string; enabled: boolean };

const GROUPS: { id: string; label: string; blurb: string; match: (t: TemplateDef) => boolean }[] = [
  {
    id: "customer-email",
    label: "Emails to customers",
    blurb: "Sent to the customer's own email address.",
    match: (t) => t.audience === "CUSTOMER",
  },
  {
    id: "brand-email",
    label: "Emails to the brand",
    blurb: "What your team is told. All of these go to your official address.",
    match: (t) => t.audience === "BRAND",
  },
];

export function TemplateManager({
  configs,
  storeEmail,
}: {
  configs: Record<TemplateKey, Config>;
  storeEmail: string;
}) {
  const [groupId, setGroupId] = useState(GROUPS[0].id);
  const group = GROUPS.find((g) => g.id === groupId)!;
  const visible = TEMPLATES.filter(group.match);

  return (
    <div>
      <p className="max-w-[78ch] text-[13px] text-muted">
        Edit what each message says. Only the message text can be changed — who it goes to and its subject line are
        fixed. Write {"{placeholders}"} where a real value should go (order number, customer name, a receipt…); tap a
        placeholder under a message to drop it in, and the preview shows how it will read.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {GROUPS.map((g) => {
          const count = TEMPLATES.filter(g.match).length;
          return (
            <button
              key={g.id}
              onClick={() => setGroupId(g.id)}
              className={`border px-3.5 py-2 text-sm ${
                groupId === g.id ? "border-lime bg-lime/[0.1] text-lime" : "border-line-2 text-muted hover:text-paper"
              }`}
            >
              {g.label} <span className="text-muted-2">({count})</span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-[13px] text-muted">
        {group.blurb}
        {group.id === "brand-email" && (
          <>
            {" "}
            Currently <span className="text-paper">{storeEmail || "not set"}</span> — change it in Settings → Store.
          </>
        )}
      </p>

      <div className="mt-3 flex flex-col gap-4">
        {visible.map((def) => (
          // Keyed by group + message so switching tabs never leaks one card's unsaved text into another.
          <TemplateCard key={def.key} def={def} initial={configs[def.key]} />
        ))}
      </div>
    </div>
  );
}

function TemplateCard({ def, initial }: { def: TemplateDef; initial: Config }) {
  const [body, setBody] = useState(initial.body);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [saved, setSaved] = useState<Config>(initial);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const taRef = useRef<HTMLTextAreaElement>(null);
  const caretRef = useRef<number | null>(null);

  // Put the caret after a just-inserted placeholder once React has committed the new text.
  useLayoutEffect(() => {
    if (caretRef.current != null && taRef.current) {
      taRef.current.focus();
      taRef.current.setSelectionRange(caretRef.current, caretRef.current);
      caretRef.current = null;
    }
  }, [body]);

  const trimmed = body.replace(/\r\n/g, "\n").trim();
  const unknown = findUnknownPlaceholders(body, def.placeholders);
  const dirty = trimmed !== saved.body.trim() || enabled !== saved.enabled;
  const isDefault = trimmed === def.defaultBody;
  const max = MAX_BODY_LENGTH;

  const preview = renderTemplate(body, SAMPLE_VALUES);

  function insert(name: string) {
    const ta = taRef.current;
    const token = `{${name}}`;
    const start = ta?.selectionStart ?? body.length;
    const end = ta?.selectionEnd ?? body.length;
    caretRef.current = start + token.length;
    setBody(body.slice(0, start) + token + body.slice(end));
    setStatus(null);
  }

  function save() {
    setStatus(null);
    startTransition(async () => {
      const res = await saveMessageTemplate({ key: def.key, body, enabled });
      if (!res.ok) {
        setStatus({ kind: "error", text: res.error });
        return;
      }
      setSaved({ body: trimmed, enabled });
      setBody(trimmed);
      setStatus({ kind: "ok", text: "Saved." });
    });
  }

  function reset() {
    if (!window.confirm("Go back to the default wording? Your edited version will be lost.")) return;
    setStatus(null);
    startTransition(async () => {
      const res = await resetMessageTemplate(def.key);
      if (!res.ok) {
        setStatus({ kind: "error", text: res.error });
        return;
      }
      setBody(def.defaultBody);
      setSaved({ body: def.defaultBody, enabled: saved.enabled });
      setStatus({ kind: "ok", text: "Back to the default." });
    });
  }

  return (
    <section id={def.key} className="border border-line bg-panel">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <h3 className="font-impact text-[17px] uppercase tracking-[0.5px]">{def.title}</h3>
          <p className="mt-0.5 text-[13px] text-muted">{def.when}</p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked);
              setStatus(null);
            }}
            className="accent-lime"
          />
          Send this message
        </label>
      </div>

      <div className="px-4 py-3.5">
        {def.subject && (
          <p className="mb-2.5 text-[13px]">
            <span className="font-label tracking-[1px] text-muted-2">SUBJECT (FIXED) </span>
            <span className="text-[#ddd]">{renderTemplate(def.subject, SAMPLE_VALUES)}</span>
          </p>
        )}

        <label className="font-label mb-1 block text-[12px] tracking-[1.2px] text-muted" htmlFor={`body-${def.key}`}>
          MESSAGE
        </label>
        <textarea
          id={`body-${def.key}`}
          ref={taRef}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setStatus(null);
          }}
          rows={Math.min(18, Math.max(4, body.split("\n").length + 1))}
          className={`w-full resize-y border bg-ink px-3 py-2.5 font-mono text-[13px] leading-relaxed outline-none focus:border-lime ${
            unknown.length > 0 ? "border-error" : "border-line-2"
          }`}
        />
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted-2">
          <span>
            {trimmed.length} / {max} characters typed
          </span>
        </div>
        {unknown.length > 0 && (
          <p className="mt-1.5 text-[13px] text-error">
            {unknown.map((u) => `{${u}}`).join(", ")} isn&apos;t available in this message — it would be sent as plain text.
          </p>
        )}

        <div className="mt-2.5">
          <span className="font-label text-[12px] tracking-[1.2px] text-muted-2">TAP TO INSERT</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {def.placeholders.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => insert(name)}
                title={PLACEHOLDERS[name]}
                className="border border-line-2 px-2 py-0.5 font-mono text-[12px] text-cyan hover:border-cyan"
              >
                {`{${name}}`}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3.5">
          <span className="font-label text-[12px] tracking-[1.2px] text-muted-2">PREVIEW (SAMPLE DATA)</span>
          <pre className="mt-1.5 max-h-[320px] overflow-auto whitespace-pre-wrap border border-dashed border-line-2 bg-ink/60 px-3 py-2.5 font-sans text-[13px] leading-relaxed text-[#ddd]">
            {preview}
          </pre>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
          <button
            onClick={save}
            disabled={pending || !dirty || unknown.length > 0}
            className="btn-primary bg-lime px-4 py-2 font-impact text-sm text-ink disabled:opacity-40"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          {!isDefault && (
            <button onClick={reset} disabled={pending} className="border border-line-2 px-3.5 py-2 text-sm hover:border-lime disabled:opacity-50">
              Reset to default
            </button>
          )}
          {dirty && !status && <span className="text-[13px] text-yellow">Unsaved changes</span>}
          {status && (
            <span className={`text-[13px] ${status.kind === "ok" ? "text-lime" : "text-error"}`}>{status.text}</span>
          )}
        </div>
      </div>
    </section>
  );
}
