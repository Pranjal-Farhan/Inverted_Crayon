/**
 * The crayon marks that dress the three product-description sections — curly braces, square
 * brackets, hash marks and double exclamation marks, drawn the way the brand's reference sheet
 * draws them (chunky, hand-pressed strokes with a chalky edge). Purely presentational SVG.
 *
 * Each mark needs an `id` that is unique on the page: it seeds that SVG's own roughness filter.
 */

export type DescriptionSectionKey = "mood" | "build" | "wear";

export type DescriptionSectionSpec = {
  key: DescriptionSectionKey;
  /** The heading exactly as the brand writes it. */
  title: string;
  /** Heading + underline + top rule colour. */
  color: string;
  /** What goes before and after the heading. */
  open: GlyphKind;
  close: GlyphKind;
  closeColor: string;
  /** Admin-side hint under the box. */
  hint: string;
  placeholder: string;
};

export const DESCRIPTION_SECTIONS: DescriptionSectionSpec[] = [
  {
    key: "mood",
    title: "Mood",
    color: "var(--color-ic-pink)",
    open: "brace-l",
    close: "brace-r",
    closeColor: "var(--color-ic-pink)",
    hint: "The feel of the piece — the vibe, the attitude, who it's for. A line or two.",
    placeholder: "Loud on purpose. A boxy, easy cut with graphics that crack and fade like they've already lived a little…",
  },
  {
    key: "build",
    title: "Build",
    color: "var(--color-ic-cyan)",
    open: "bracket-l",
    close: "bracket-r",
    closeColor: "var(--color-ic-cyan)",
    hint: "Fabric, fit, construction, care. Start a line with “- ” to make a bullet list.",
    placeholder: "- 100% heavyweight cotton\n- Boxy cut, dropped shoulder\n- Screen-printed, washed to crack and fade",
  },
  {
    key: "wear",
    title: "How n when to wear",
    color: "var(--color-ic-lime)",
    open: "hash",
    close: "bang",
    closeColor: "var(--color-ic-yellow)",
    hint: "Styling ideas and the occasions it's made for. Leave a blank line between paragraphs.",
    placeholder: "Throw it over a plain tee for the weekend, or let it carry a whole look on its own.\n\nBest for: late nights out, campus days, studio sessions.",
  },
];

export type GlyphKind = "brace-l" | "brace-r" | "bracket-l" | "bracket-r" | "hash" | "bang";

const GLYPHS: Record<GlyphKind, { viewBox: string; paths: string[]; width: number }> = {
  "brace-l": {
    viewBox: "0 0 40 80",
    paths: ["M31,6 C20,6 21,17 21,27 C21,35 18,38 8,40 C18,42 21,45 21,53 C21,63 20,74 31,74"],
    width: 7.5,
  },
  "brace-r": {
    viewBox: "0 0 40 80",
    paths: ["M9,6 C20,6 19,17 19,27 C19,35 22,38 32,40 C22,42 19,45 19,53 C19,63 20,74 9,74"],
    width: 7.5,
  },
  "bracket-l": { viewBox: "0 0 40 80", paths: ["M30,7 L11,6 L10,73 L30,74"], width: 8 },
  "bracket-r": { viewBox: "0 0 40 80", paths: ["M10,6 L29,7 L30,74 L10,73"], width: 8 },
  // "##" — two chunky hash marks, a little off-square like they were drawn by hand
  hash: {
    viewBox: "0 0 108 80",
    paths: [
      "M20,8 L15,72",
      "M41,8 L36,72",
      "M6,28 L52,25",
      "M5,53 L50,56",
      "M72,8 L67,72",
      "M93,8 L88,72",
      "M58,28 L104,25",
      "M57,53 L102,56",
    ],
    width: 7,
  },
  // "!!" — two exclamation marks; the round-capped zero-length stroke is the dot
  bang: {
    viewBox: "0 0 60 80",
    paths: ["M14,8 L16,50", "M16,68 L16,69", "M42,8 L44,50", "M44,68 L44,69"],
    width: 9,
  },
};

/** One crayon mark. Size it with a height class (the width follows the mark's own proportions). */
export function CrayonGlyph({ id, kind, color, className }: { id: string; kind: GlyphKind; color: string; className?: string }) {
  const g = GLYPHS[kind];
  const fid = `dm-${id}`;
  return (
    <svg viewBox={g.viewBox} className={className} aria-hidden="true" focusable="false" style={{ overflow: "visible" }}>
      <defs>
        <filter id={fid} x="-25%" y="-25%" width="150%" height="150%">
          <feTurbulence type="fractalNoise" baseFrequency="0.07 0.55" numOctaves="2" seed={id.length * 7 + kind.length} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter={`url(#${fid})`} stroke={color} strokeWidth={g.width} strokeLinecap="round" strokeLinejoin="round" fill="none">
        {g.paths.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </svg>
  );
}

/** A loose crayon underline to sit beneath a heading. */
export function CrayonUnderline({ id, color, className }: { id: string; color: string; className?: string }) {
  const fid = `du-${id}`;
  return (
    <svg viewBox="0 0 160 16" className={className} aria-hidden="true" focusable="false" preserveAspectRatio="none" style={{ overflow: "visible" }}>
      <defs>
        <filter id={fid} x="-10%" y="-80%" width="120%" height="260%">
          <feTurbulence type="fractalNoise" baseFrequency="0.05 0.6" numOctaves="2" seed={id.length + 3} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="3" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <path d="M5,10 Q36,3 70,9 T155,7" filter={`url(#${fid})`} stroke={color} strokeWidth="5.5" strokeLinecap="round" fill="none" opacity="0.95" />
    </svg>
  );
}

/** The heading itself: opening mark, the words in the site's marker font, closing mark. */
export function SectionHeading({ spec, idPrefix, level = "h3", size = "lg" }: { spec: DescriptionSectionSpec; idPrefix: string; level?: "h2" | "h3" | "div"; size?: "lg" | "sm" }) {
  const Tag = level;
  const glyph = size === "lg" ? "h-[30px]" : "h-[20px]";
  const text = size === "lg" ? "text-[26px]" : "text-[18px]";
  // The words flow inline so a long title wraps like text; the opening mark is glued to the first
  // word and the closing mark to the last, so neither is ever stranded on a line of its own.
  const words = spec.title.split(" ");
  const first = words[0];
  const last = words.length > 1 ? words[words.length - 1] : null;
  const middle = words.slice(1, -1).join(" ");
  const open = <CrayonGlyph id={`${idPrefix}-o`} kind={spec.open} color={spec.color} className={`${glyph} mr-1.5 inline-block w-auto align-middle`} />;
  const close = <CrayonGlyph id={`${idPrefix}-c`} kind={spec.close} color={spec.closeColor} className={`${glyph} ml-1.5 inline-block w-auto align-middle`} />;
  return (
    <div>
      <Tag className={`m-0 font-scrawl leading-[1.25] ${text}`} style={{ color: spec.color }}>
        <span className="whitespace-nowrap">
          {open}
          {first}
          {last === null && close}
        </span>
        {last !== null && (
          <>
            {" "}
            {middle && <>{middle} </>}
            <span className="whitespace-nowrap">
              {last}
              {close}
            </span>
          </>
        )}
      </Tag>
      {size === "lg" && <CrayonUnderline id={`${idPrefix}-u`} color={spec.color} className="mt-2.5 h-[10px] w-[150px] max-w-[60%]" />}
    </div>
  );
}
