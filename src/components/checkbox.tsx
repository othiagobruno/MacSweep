import { Check, Minus } from "lucide-react";

interface CheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}

/** Accessible custom checkbox (keyboard + screen reader friendly). */
export function Checkbox({
  checked,
  indeterminate = false,
  onChange,
  label,
  disabled,
}: CheckboxProps) {
  const state = indeterminate ? "mixed" : checked;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={state}
      aria-label={label}
      disabled={disabled}
      className={`checkbox ${checked ? "checked" : indeterminate ? "indeterminate" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
    >
      {checked && <Check size={12} strokeWidth={3} />}
      {!checked && indeterminate && <Minus size={12} strokeWidth={3} />}
    </button>
  );
}

interface SwitchProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  busy?: boolean;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, busy, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-busy={busy}
      disabled={disabled || busy}
      className={`settings-toggle ${checked ? "active" : ""} ${busy ? "busy" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="settings-toggle-knob" />
    </button>
  );
}
