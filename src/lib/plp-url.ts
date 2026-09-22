export type RawSearchParams = Record<string, string | string[] | undefined>;

export function toSearchParams(raw: RawSearchParams): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (value == null) continue;
    if (Array.isArray(value)) value.forEach((v) => sp.append(key, v));
    else sp.set(key, value);
  }
  return sp;
}

/** Toggle a value inside a comma-separated multi-value query param. */
export function toggleListParam(sp: URLSearchParams, key: string, value: string): string {
  const next = new URLSearchParams(sp);
  const current = (next.get(key) ?? "").split(",").filter(Boolean);
  const has = current.includes(value);
  const updated = has ? current.filter((v) => v !== value) : [...current, value];
  if (updated.length) next.set(key, updated.join(","));
  else next.delete(key);
  next.delete("page");
  return `?${next.toString()}`;
}

/** Set or clear a single-value query param (toggle off if it's already that value). */
export function toggleParam(sp: URLSearchParams, key: string, value: string): string {
  const next = new URLSearchParams(sp);
  if (next.get(key) === value) next.delete(key);
  else next.set(key, value);
  next.delete("page");
  return `?${next.toString()}`;
}

export function setParam(sp: URLSearchParams, key: string, value: string | null): string {
  const next = new URLSearchParams(sp);
  if (value == null || value === "") next.delete(key);
  else next.set(key, value);
  next.delete("page");
  return `?${next.toString()}`;
}

export function clearParam(sp: URLSearchParams, key: string): string {
  const next = new URLSearchParams(sp);
  next.delete(key);
  next.delete("page");
  return `?${next.toString()}`;
}

export function listParam(sp: URLSearchParams, key: string): string[] {
  return (sp.get(key) ?? "").split(",").filter(Boolean);
}
