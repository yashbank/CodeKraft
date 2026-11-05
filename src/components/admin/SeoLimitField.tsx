"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { Field } from "./RichTextField";

/** SEO text field: hard `max` via maxLength, live "n/hint" counter that flags going past the recommended length. */
export function SeoLimitField({
  id,
  name,
  label,
  defaultValue,
  hint,
  max,
  multiline,
  optional,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue?: string;
  hint: number;
  max: number;
  multiline?: boolean;
  optional?: boolean;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const common = {
    id,
    name,
    value,
    maxLength: max,
    "aria-describedby": `${id}-hint`,
    onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) =>
      setValue(e.target.value),
  };
  return (
    <Field
      id={id}
      label={label}
      optional={optional}
      hint={`${value.length}/${hint} recommended${value.length > hint ? " (longer may be cut off in search results)" : ""}, ${max} max`}
    >
      {multiline ? <Textarea {...common} rows={2} /> : <Input {...common} />}
    </Field>
  );
}
