// Ayuda (UX-12): inicio rápido, glosario, atajos, limitaciones, advertencia profesional y enlaces, dentro de un `<dialog>`
// nativo con índice interno. Esc lo cierra y el foco vuelve al botón «Ayuda». El contenido vive en `onboarding/helpContent.ts`.

import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import {
  GLOSSARY,
  HELP_LINKS,
  HELP_SECTIONS,
  LIMITATIONS,
  POINTER_HINTS,
  PROFESSIONAL_WARNING,
  QUICK_START,
  SHORTCUTS,
  type GlossaryTable,
  type Shortcut,
} from '../onboarding/helpContent';
import { restoreFocus } from './focusReturn';

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="visually-hidden"> (se abre en una pestaña nueva)</span>
    </a>
  );
}

function GlossaryRefTable({ id, table }: { id: string; table: GlossaryTable }) {
  return (
    <div className="help-table-wrap" role="region" aria-labelledby={id} tabIndex={0}>
      <table className="help-table">
        <caption id={id}>{table.caption}</caption>
        <thead>
          <tr>
            {table.header.map((col) => (
              <th key={col} scope="col">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row[0]}>
              <th scope="row">{row[0]}</th>
              {row.slice(1).map((cell, ci) => (
                <td key={ci}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ShortcutTable({ id, caption, rows }: { id: string; caption: string; rows: readonly Shortcut[] }) {
  return (
    <div className="help-table-wrap" role="region" aria-labelledby={id} tabIndex={0}>
      <table className="help-table">
        <caption id={id}>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Teclas</th>
            <th scope="col">Acción</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.keys}>
              <th scope="row">
                <kbd>{s.keys}</kbd>
              </th>
              <td>{s.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HelpDialog({ onClose, onStartTour }: { onClose: () => void; onStartTour: () => void }) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const shortcutsCap = useId();
  const canvasCap = useId();
  // El botón «Ayuda» (quien tenía el foco al abrir). Se captura una sola vez: en desarrollo (StrictMode) el efecto corre dos veces.
  const [opener] = useState(() => (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null));

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previous = opener;
    if (!dialog.open) dialog.showModal();
    titleRef.current?.focus();
    // Al desmontar el navegador saca el diálogo de la capa superior; solo falta devolver el foco al botón «Ayuda».
    return () => {
      restoreFocus(null, previous, { preventScroll: true }); // el foco nunca cae en <body>, aunque el botón «Ayuda» ya no se pueda enfocar (R9-11c)
    };
  }, [opener]);

  const goTo = (e: MouseEvent<HTMLAnchorElement>, id: string): void => {
    e.preventDefault();
    const heading = dialogRef.current?.querySelector<HTMLElement>(`#help-${id}`);
    if (!heading) return;
    heading.scrollIntoView({ block: 'start' });
    heading.focus();
  };

  const global = SHORTCUTS.filter((s) => s.scope === 'global');
  const canvas = SHORTCUTS.filter((s) => s.scope === 'canvas');

  return (
    <dialog
      ref={dialogRef}
      className="ea-dialog help-dialog"
      aria-labelledby={titleId}
      data-testid="help-dialog"
      onCancel={(e) => {
        e.preventDefault(); // el estado de React decide cuándo desaparece
        onClose();
      }}
      onClose={onClose}
    >
      <div className="help-head">
        <h2 id={titleId} ref={titleRef} tabIndex={-1}>
          Ayuda
        </h2>
        <button type="button" onClick={onClose}>
          Cerrar
        </button>
      </div>
      <div className="help-scroll">
        <nav aria-label="Contenido de la ayuda" className="help-index">
          <ul>
            {HELP_SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#help-${s.id}`} onClick={(e) => goTo(e, s.id)}>
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <section>
          <h3 id="help-quick-start" tabIndex={-1}>
            Inicio rápido
          </h3>
          <ol className="help-steps">
            {QUICK_START.map((s) => (
              <li key={s.id}>
                <strong>{s.title}.</strong> {s.body}
              </li>
            ))}
          </ol>
          <p>
            <button type="button" className="primary" onClick={onStartTour} data-testid="help-start-tour">
              Recorrido guiado
            </button>{' '}
            <span className="muted small">Repite la guía de primera visita sobre la propia aplicación.</span>
          </p>
        </section>

        <section>
          <h3 id="help-glossary" tabIndex={-1}>
            Glosario
          </h3>
          <dl className="help-glossary">
            {GLOSSARY.map((g) => (
              <div key={g.id} className="help-term">
                <dt>{g.term}</dt>
                <dd>
                  <p>{g.definition}</p>
                  {g.table ? <GlossaryRefTable id={`${titleId}-${g.id}-table`} table={g.table} /> : null}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h3 id="help-shortcuts" tabIndex={-1}>
            Atajos de teclado
          </h3>
          <ShortcutTable id={shortcutsCap} caption="Atajos de la aplicación (modo Editar, fuera de los campos de texto)" rows={global} />
          <ShortcutTable id={canvasCap} caption="Con el foco en el lienzo" rows={canvas} />
          <h4>Ratón y táctil</h4>
          <ul>
            {POINTER_HINTS.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </section>

        <section>
          <h3 id="help-limits" tabIndex={-1}>
            Limitaciones
          </h3>
          <ul>
            {LIMITATIONS.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <p>
            La lista completa está en el <ExternalLink href={HELP_LINKS.limitations}>README, sección «Limitaciones conocidas»</ExternalLink>.
          </p>
        </section>

        <section>
          <h3 id="help-warning" tabIndex={-1}>
            Advertencia profesional
          </h3>
          <p className="help-warning">{PROFESSIONAL_WARNING}</p>
        </section>

        <section>
          <h3 id="help-links" tabIndex={-1}>
            Enlaces y cita
          </h3>
          <ul>
            <li>
              <ExternalLink href={HELP_LINKS.repo}>Repositorio en GitHub</ExternalLink>
            </li>
            <li>
              <ExternalLink href={HELP_LINKS.releases}>Releases (versiones publicadas)</ExternalLink>
            </li>
            <li>
              <ExternalLink href={HELP_LINKS.cite}>Citar OpenGeoSlide (CITATION.cff)</ExternalLink>
            </li>
          </ul>
        </section>
      </div>
    </dialog>
  );
}
