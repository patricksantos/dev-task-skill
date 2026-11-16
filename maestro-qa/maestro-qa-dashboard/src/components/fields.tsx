"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { IconChevron } from "@/components/icons";

export type FieldOption = { value: string; label: string };

export function SelectField({
  label,
  value,
  options,
  onChange,
  disabled = false,
  ariaLabel,
  name,
  placeholder = "Selecionar",
}: {
  label?: string;
  value: string;
  options: FieldOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
  name?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);
  const title = ariaLabel ?? label ?? "Selecionar";

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="field-group">
      {label ? <span className="field-label">{label}</span> : null}
      <div className={open ? "select open" : "select"} ref={root}>
        {name ? <input type="hidden" name={name} value={value} /> : null}
        <button
          type="button"
          className="select-trigger"
          aria-label={title}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
        >
          <span className="select-value">{selected?.label ?? placeholder}</span>
          <IconChevron />
        </button>
        {open ? (
          <ul className="select-menu" role="listbox" id={listId} aria-label={title}>
            {options.map((option) => (
              <li key={option.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  className={option.value === value ? "select-option selected" : "select-option"}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

export function TextField({
  label,
  value,
  defaultValue,
  onChange,
  name,
  placeholder,
  readOnly,
  required,
  maxLength,
  ariaLabel,
  type = "text",
}: {
  label?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  placeholder?: string;
  readOnly?: boolean;
  required?: boolean;
  maxLength?: number;
  ariaLabel?: string;
  type?: "text" | "search";
}) {
  function handle(event: ChangeEvent<HTMLInputElement>) {
    onChange?.(event.target.value);
  }
  return (
    <label className="field-group">
      {label ? <span className="field-label">{label}</span> : null}
      <input
        className="field"
        type={type}
        name={name}
        {...(value !== undefined ? { value, onChange: handle } : { defaultValue, onChange: onChange ? handle : undefined })}
        placeholder={placeholder}
        readOnly={readOnly}
        required={required}
        maxLength={maxLength}
        aria-label={ariaLabel ?? label}
      />
    </label>
  );
}

export function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div className="field-group">
      <span className="field-label">{label}</span>
      <p className="field read">{value || "—"}</p>
    </div>
  );
}
