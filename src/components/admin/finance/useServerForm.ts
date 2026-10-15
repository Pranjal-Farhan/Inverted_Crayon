"use client";

import { useState, useTransition } from "react";

type Result = { ok: boolean; error: string };

/**
 * Submits a form to a server action WITHOUT React's automatic form reset. With `<form action={fn}>`
 * React 19 clears every uncontrolled field after the action runs — including when the server
 * answered "that amount isn't valid", which would wipe what the person just typed. Here the fields
 * stay as they were on an error; the caller resets (or closes the editor) only on success.
 */
export function useServerForm(action: (prev: Result | null, formData: FormData) => Promise<Result>, onSuccess?: () => void) {
  const [state, setState] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    start(async () => {
      const result = await action(null, data);
      setState(result);
      if (result.ok) onSuccess?.();
    });
  };
  return { state, pending, onSubmit };
}
