"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { StatusScope } from "@/lib/portal/config";
import { setStatusScope } from "@/lib/portal/config-action";
import { FieldLabel, Select } from "@/components/app/field";

/**
 * The one setting on this page that actually does something.
 *
 * Applied on change rather than behind an Apply button, because the original
 * promises "changes apply immediately across all tabs" and there is exactly one
 * control — the consistency argument that made the Merit List filters wait for
 * a button does not apply to a form with a single field.
 *
 * `router.refresh()` after the action re-renders the server components with the
 * new cookie in place, so the overview cards beside it update in the same beat.
 */
export function ScopeSelector({
  scopes,
  active,
}: {
  scopes: StatusScope[];
  active: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(active);
  const [pending, startTransition] = useTransition();

  function change(next: string) {
    setValue(next);
    startTransition(async () => {
      await setStatusScope(next);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <FieldLabel htmlFor="cfg-scope">Default status scope</FieldLabel>
      <Select
        id="cfg-scope"
        value={value}
        disabled={pending}
        onChange={(e) => change(e.target.value)}
      >
        {scopes.map((scope) => (
          <option key={scope.id} value={scope.id}>
            {scope.label}
          </option>
        ))}
      </Select>
      <p aria-live="polite" className="mt-1 font-mono text-[10px] text-fg-subtle">
        {pending ? "Applying…" : "Applies across every portal tab."}
      </p>
    </div>
  );
}
