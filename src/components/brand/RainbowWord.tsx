const RAINBOW_COLORS = ["#26a7e6", "#ff2d84", "#c3f53a", "#ffd23b"];

/**
 * Renders `text` with each letter cycling through the brand accent palette —
 * the hand-scrawled "rainbow crayon" treatment for the second word of the
 * wordmark, paired with a plain-white first word (Header.tsx).
 */
export function RainbowWord({ text }: { text: string }) {
  let colorIndex = 0;
  return (
    <>
      {text.split("").map((ch, i) => {
        if (ch === " ") return <span key={i}> </span>;
        const color = RAINBOW_COLORS[colorIndex % RAINBOW_COLORS.length];
        colorIndex++;
        return (
          <span key={i} style={{ color }}>
            {ch}
          </span>
        );
      })}
    </>
  );
}
