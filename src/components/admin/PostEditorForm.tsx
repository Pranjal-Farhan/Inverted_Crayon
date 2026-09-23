"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { savePost, deletePost } from "@/actions/admin-posts";
import { Panel } from "@/components/admin/Panel";

const COLORS = ["#ff2d84", "#c3f53a", "#26a7e6", "#ffd23b"];

export function PostEditorForm({
  initial,
}: {
  initial: {
    id: string;
    slug: string;
    title: string;
    excerpt: string;
    body: string;
    accentColor: string;
    authorName: string;
    status: "DRAFT" | "PUBLISHED";
  } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [accentColor, setAccentColor] = useState(initial?.accentColor ?? COLORS[0]);
  const [authorName, setAuthorName] = useState(initial?.authorName ?? "Inverted Crayon");
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED">(initial?.status ?? "DRAFT");

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await savePost({ id: initial?.id, slug, title, excerpt, body, accentColor, authorName, status });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/admin/journal/${res.id}`);
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4.5 desktop:grid-cols-[1.4fr_1fr]">
      <Panel title="Post">
        <Field label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Excerpt">
          <textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} className={inputClass} />
        </Field>
        <Field label="Body">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} className={inputClass} />
        </Field>
      </Panel>

      <div>
        <Panel title="Publish">
          <Field label="Author">
            <input value={authorName} onChange={(e) => setAuthorName(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Slug">
            <input value={slug} onChange={(e) => setSlug(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Accent">
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setAccentColor(c)}
                  className={`h-7 w-7 rounded-full border-2 ${accentColor === c ? "border-white" : "border-transparent"}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </Field>
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={inputClass}>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
            </select>
          </Field>
          {error && <p className="mb-2 text-[13px] text-error">{error}</p>}
          <button
            onClick={submit}
            disabled={pending}
            className="btn-primary w-full bg-lime px-4 py-2.5 font-impact text-sm text-ink disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save post"}
          </button>
          {initial?.id && (
            <button
              onClick={() => {
                if (confirm("Delete this post permanently?")) startTransition(() => deletePost(initial.id));
              }}
              className="mt-2 w-full border border-line-2 px-4 py-2 text-sm text-error hover:border-error"
            >
              Delete post
            </button>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="font-label mb-1.5 block text-[13px] tracking-[1.2px] text-muted">{label}</label>
      {children}
    </div>
  );
}

const inputClass = "w-full border border-line-2 bg-ink px-3 py-2 text-sm outline-none focus:border-lime";
