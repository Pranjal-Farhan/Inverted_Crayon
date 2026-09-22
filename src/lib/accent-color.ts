const COLORS = ["#ff2d84", "#c3f53a", "#26a7e6", "#ffd23b"];
const SHAPES = ["x", "circle", "square"] as const;

function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

export function pickAccent(seed: string): { color: string; shape: (typeof SHAPES)[number] } {
  const h = hash(seed);
  return { color: COLORS[h % COLORS.length], shape: SHAPES[h % SHAPES.length] };
}
