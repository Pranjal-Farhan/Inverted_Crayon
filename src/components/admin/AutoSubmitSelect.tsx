"use client";

import type { ReactNode } from "react";

/**
 * A GET-form filter `<select>` that submits itself the instant a new option is picked, instead of
 * requiring a separate "Filter" button click. Factored out as its own small client component
 * because the list pages that use this (Orders, Customers) are Server Components — an inline
 * `onChange` directly on a `<select>` there throws ("Event handlers cannot be passed to Client
 * Component props"), since a function literal can't cross the server/client boundary no matter
 * how plain the element it's attached to is. This is the one interactive sliver, nothing else
 * about those pages needs to become a client component.
 */
export function AutoSubmitSelect({
  name,
  defaultValue,
  className,
  children,
}: {
  name: string;
  defaultValue: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className={className}
    >
      {children}
    </select>
  );
}
