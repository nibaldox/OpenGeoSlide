import { useId, type KeyboardEvent, type ReactNode } from 'react';
import type { FieldErrors } from './forms';
import './panels.css';

export function PanelSection({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <section className={`panel ep-panel${className ? ` ${className}` : ''}`} aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}

export interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Enter o pérdida de foco: confirma. */
  onCommit?: () => void;
  /** Esc: descarta el borrador. */
  onReset?: () => void;
  onFocus?: () => void;
  ariaLabel: string;
  invalid?: boolean;
  describedBy?: string;
  readOnly?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** `decimal` (por defecto) abre el teclado numérico; `text` para ids y nombres. */
  mode?: 'decimal' | 'text';
  className?: string;
}

export function TextInput(props: TextInputProps) {
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      props.onCommit?.();
    } else if (e.key === 'Escape') {
      props.onReset?.();
    }
  };
  return (
    <input
      type="text"
      inputMode={props.mode === 'text' ? 'text' : 'decimal'}
      autoComplete="off"
      spellCheck={false}
      className={props.className}
      value={props.value}
      aria-label={props.ariaLabel}
      aria-invalid={props.invalid ? true : undefined}
      aria-describedby={props.invalid ? props.describedBy : undefined}
      readOnly={props.readOnly}
      disabled={props.disabled}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
      onBlur={() => props.onCommit?.()}
      onFocus={() => props.onFocus?.()}
      onKeyDown={onKeyDown}
    />
  );
}

/** Campo con etiqueta visible, unidad y mensaje de error. */
export function LabeledField(props: Omit<TextInputProps, 'ariaLabel' | 'invalid' | 'describedBy'> & {
  label: string;
  unit?: string;
  error?: string;
  hint?: string;
}) {
  const errorId = useId();
  const { label, unit, error, hint, ...input } = props;
  return (
    <div className="field ep-field">
      <label>
        <span>
          {label}
          {unit ? <span className="muted"> ({unit})</span> : null}
        </span>
        <TextInput {...input} ariaLabel={unit ? `${label} (${unit})` : label} invalid={Boolean(error)} describedBy={errorId} />
      </label>
      {hint ? <span className="muted small">{hint}</span> : null}
      {error ? (
        <span id={errorId} className="ep-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

/** Lista de mensajes de error de un formulario (una línea por campo). */
export function ErrorList({ errors, id }: { errors: FieldErrors; id?: string }) {
  const messages = Array.from(new Set(Object.values(errors)));
  if (messages.length === 0) return null;
  return (
    <ul className="ep-error-list" id={id} role="alert">
      {messages.map((m) => (
        <li key={m}>{m}</li>
      ))}
    </ul>
  );
}
