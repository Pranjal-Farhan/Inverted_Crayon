"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { inputCls } from "./ui";

export type PickerOption = {
  id: string;
  label: string;
  /** Extra text that can be searched but isn't shown (SKU, colour…). */
  search?: string;
  /** Shown on the right, e.g. "9 in stock". */
  hint?: string;
  dim?: boolean;
};

const MAX_SHOWN = 60;

/**
 * A product chooser you can type into: start writing part of a name, size, colour or SKU and the
 * list narrows to what matches (every word you type has to appear). Arrow keys + Enter pick,
 * Escape closes. `customLabel` adds a first entry that clears the choice (e.g. "Custom item").
 * With `name`, the chosen id is also submitted as a hidden field, so it works inside a plain form.
 */
export function ProductPicker({
  options,
  value,
  onChange,
  name,
  placeholder = "Search products…",
  customLabel,
  ariaLabel,
  className = "",
}: {
  options: PickerOption[];
  value: string;
  onChange: (id: string) => void;
  name?: string;
  placeholder?: string;
  customLabel?: string;
  ariaLabel: string;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.id === value);

  const matches = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const found = words.length === 0 ? options : options.filter((o) => {
      const hay = `${o.label} ${o.search ?? ""}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
    return found;
  }, [options, query]);

  const shown = matches.slice(0, MAX_SHOWN);
  // Row 0 is the "custom" entry when there is one.
  const rows: { id: string; option?: PickerOption }[] = [...(customLabel ? [{ id: "" }] : []), ...shown.map((o) => ({ id: o.id, option: o }))];

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function choose(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className={`relative ${className}`}>
      {name && <input type="hidden" name={name} value={value} />}
      <input
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && rows[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        className={inputCls}
        placeholder={selected ? undefined : (customLabel ?? placeholder)}
        value={open ? query : (selected?.label ?? "")}
        onFocus={() => {
          setQuery("");
          setActive(0);
          setOpen(true);
        }}
        // Focus alone isn't enough: after a pick the input keeps focus with the list closed, and clicking it should reopen.
        onClick={() => {
          if (open) return;
          setQuery("");
          setActive(0);
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(rows.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter" && open) {
            e.preventDefault(); // don't submit the form while choosing
            if (rows[active]) choose(rows[active].id);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={`${ariaLabel} — suggestions`}
          className="absolute left-0 right-0 z-30 mt-1 max-h-[280px] overflow-y-auto border border-line-2 bg-panel shadow-[0_12px_30px_rgba(0,0,0,.6)]"
        >
          {rows.map((r, i) => (
            <li
              key={r.id || "custom"}
              id={`${listId}-${i}`}
              data-index={i}
              role="option"
              aria-selected={r.id === value}
              // mousedown (not click) so the input's blur doesn't close the list before the pick lands
              onMouseDown={(e) => {
                e.preventDefault();
                choose(r.id);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2 text-sm ${i === active ? "bg-lime/[0.14]" : ""} ${r.option?.dim ? "text-muted" : ""}`}
            >
              {r.option ? (
                <>
                  <span className="min-w-0 break-words">{r.option.label}</span>
                  {r.option.hint && <span className="shrink-0 text-[12px] text-muted-2">{r.option.hint}</span>}
                </>
              ) : (
                <span className="text-muted">{customLabel}</span>
              )}
            </li>
          ))}
          {shown.length === 0 && <li className="px-3 py-3 text-sm text-muted">No product matches “{query}”.</li>}
          {matches.length > MAX_SHOWN && <li className="px-3 py-2 text-[12px] text-muted-2">Showing the first {MAX_SHOWN} of {matches.length} — keep typing to narrow it down.</li>}
        </ul>
      )}
    </div>
  );
}
