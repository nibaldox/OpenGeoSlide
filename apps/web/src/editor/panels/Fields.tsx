import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { FieldErrors } from './forms';
import { describedByIds, errorRole, nextFieldAnnounce, type FieldAnnounce } from './fieldA11y';
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
  /** Nombre accesible cuando no hay `<label>` asociado (celdas de tabla). */
  ariaLabel?: string;
  id?: string;
  /** Puntero JSON del campo del modelo (`data-path`): el panel de Diagnósticos lo usa para llevar el foco (R7-11). */
  path?: string;
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
      id={props.id}
      data-path={props.path}
      inputMode={props.mode === 'text' ? 'text' : 'decimal'}
      autoComplete="off"
      spellCheck={false}
      className={props.className}
      value={props.value}
      aria-label={props.ariaLabel}
      aria-invalid={props.invalid ? true : undefined}
      aria-describedby={props.describedBy}
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

/**
 * Campo con etiqueta visible (`<label for>`), unidad, ayuda y mensaje de error. La ayuda se enlaza siempre con
 * `aria-describedby`; el error se enlaza mientras exista y solo se anuncia (`role="alert"`) al confirmar el campo.
 */
export function LabeledField(props: Omit<TextInputProps, 'ariaLabel' | 'invalid' | 'describedBy' | 'id'> & {
  label: string;
  unit?: string;
  error?: string;
  hint?: string;
}) {
  const base = useId();
  const inputId = `${base}-in`;
  const hintId = `${base}-hint`;
  const errorId = `${base}-err`;
  const [announce, setAnnounce] = useState<FieldAnnounce>('quiet');
  const { label, unit, error, hint, onChange, onCommit, onReset, ...input } = props;
  return (
    <div className="field ep-field">
      <label htmlFor={inputId}>
        {label}
        {unit ? <span className="muted"> ({unit})</span> : null}
      </label>
      {hint ? (
        <span id={hintId} className="muted small">
          {hint}
        </span>
      ) : null}
      <TextInput
        {...input}
        id={inputId}
        invalid={Boolean(error)}
        describedBy={describedByIds({ hintId, errorId }, { hint: Boolean(hint), error: Boolean(error) })}
        onChange={(v) => {
          setAnnounce(nextFieldAnnounce('edit'));
          onChange(v);
        }}
        onCommit={() => {
          setAnnounce(nextFieldAnnounce('commit'));
          onCommit?.();
        }}
        onReset={() => {
          setAnnounce(nextFieldAnnounce('reset'));
          onReset?.();
        }}
      />
      {error ? (
        // `key` re-monta el aviso al confirmar: así el rol `alert` se anuncia en ese momento y no con cada tecla.
        <span key={announce} id={errorId} className="ep-error" role={errorRole(announce)}>
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
