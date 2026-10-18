import { DESCRIPTION_SECTIONS, SectionHeading, type DescriptionSectionKey } from "@/components/brand/DescriptionMarks";

/**
 * The product page's description: three distinct sections — Mood, Build, How n when to wear —
 * side by side across the full width on desktop, stacked one under another on mobile.
 *
 * Copy is plain text. A blank line starts a new paragraph; a line that starts with "- " (or "• ")
 * becomes a bullet. A section with no copy is left out and the others share the row.
 */

type Copy = Record<DescriptionSectionKey, string | null | undefined>;

type Block = { type: "p"; text: string } | { type: "ul"; items: string[] };

function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: string[] | null = null;
  const flushPara = () => {
    if (para.length) blocks.push({ type: "p", text: para.join(" ") });
    para = [];
  };
  const flushList = () => {
    if (list && list.length) blocks.push({ type: "ul", items: list });
    list = null;
  };
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    const bullet = /^[-•*]\s+(.*)$/.exec(line);
    if (!line) {
      flushPara();
      flushList();
    } else if (bullet) {
      flushPara();
      (list ??= []).push(bullet[1]);
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return blocks;
}

function Body({ text, color }: { text: string; color: string }) {
  const blocks = toBlocks(text);
  return (
    <div className="mt-5 space-y-3.5 font-body text-[15px] leading-[1.75] text-paper/85 desktop:text-[15.5px]">
      {blocks.map((b, i) =>
        b.type === "p" ? (
          <p key={i}>{b.text}</p>
        ) : (
          <ul key={i} className="space-y-2">
            {b.items.map((it, j) => (
              <li key={j} className="flex gap-3">
                <span aria-hidden="true" className="mt-[0.62em] h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                <span>{it}</span>
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}

export function ProductDescription({ copy, idPrefix = "pd" }: { copy: Copy; idPrefix?: string }) {
  const sections = DESCRIPTION_SECTIONS.filter((s) => (copy[s.key] ?? "").trim() !== "");
  if (sections.length === 0) return null;
  const cols = sections.length === 3 ? "desktop:grid-cols-3" : sections.length === 2 ? "desktop:grid-cols-2" : "desktop:grid-cols-1";

  return (
    <section aria-labelledby={`${idPrefix}-about`} className="mt-4 border-t border-line pt-8">
      <h2 id={`${idPrefix}-about`} className="sr-only">
        About this piece
      </h2>
      <div className={`grid grid-cols-1 gap-5 ${cols}`}>
        {sections.map((s) => (
          <article
            key={s.key}
            data-section={s.key}
            className="min-w-0 border border-line border-t-[3px] bg-panel px-5 py-6 desktop:py-8"
            style={{ borderTopColor: s.color }}
          >
            <SectionHeading spec={s} idPrefix={`${idPrefix}-${s.key}`} />
            <Body text={(copy[s.key] ?? "").trim()} color={s.color} />
          </article>
        ))}
      </div>
    </section>
  );
}
