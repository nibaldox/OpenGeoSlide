// Diálogo «Talud simple…»: parámetros del talud, vista previa del perfil y creación del modelo (`newModel.ts`).
// Usa el `<dialog>` modal nativo de `ImportDialogs` (trampa de foco, Esc y foco de vuelta al botón que lo abrió).

import { useMemo, useState } from 'react';
import { LabeledField } from '../panels/Fields';
import { formatNumber, unitLabels } from '../panels/forms';
import { Modal } from './ImportDialogs';
import { contactElevation, simpleSlope, slopeFormDefaults, slopeFromForm, type SlopeForm, type SlopeInput, type SlopeWater } from './newModel';
import './newModel.css';

const WATER_CHOICES: ReadonlyArray<{ value: SlopeWater; label: string; hint: string }> = [
  { value: 'none', label: 'Ninguna (talud seco)', hint: 'No se define línea piezométrica.' },
  {
    value: 'toe',
    label: 'En el pie',
    hint: 'El nivel freático aflora en el pie del talud y sube hasta la mitad de la altura en el extremo posterior del modelo.',
  },
  {
    value: 'crown',
    label: 'En la corona',
    hint: 'El nivel freático aflora en el pie del talud y sube hasta la cota de la corona en el extremo posterior del modelo.',
  },
];

/** Perfil del talud para la vista previa: contorno del suelo y, si existe, la piezométrica. */
function Preview({ input }: { input: SlopeInput | null }) {
  const doc = useMemo(() => (input ? simpleSlope(input) : null), [input]);
  if (!doc) {
    return (
      <p className="muted small ns-preview-empty" data-testid="slope-preview-empty">
        Corrija los valores marcados para ver el perfil.
      </p>
    );
  }
  const polys = doc.regions.map((r) => r.polygon);
  const all = polys.flat();
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const pad = Math.max(x1 - x0, y1 - y0) * 0.05;
  const w = x1 - x0 + 2 * pad;
  const h = y1 - y0 + 2 * pad;
  const sy = (y: number): number => y1 + pad - y;
  const ptsOf = (poly: readonly (readonly number[])[]): string => poly.map((p) => `${p[0]! - x0 + pad},${sy(p[1]!)}`).join(' ');
  const line = doc.water?.piezometric_line;
  return (
    <svg className="ns-preview" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Vista previa del perfil del talud" data-testid="slope-preview" preserveAspectRatio="xMidYMid meet">
      {polys.map((poly, i) => (
        <polygon key={i} data-preview-region={i} points={ptsOf(poly)} fill={`var(--canvas-mat-${i})`} stroke="var(--canvas-region-edge)" strokeWidth={Math.max(w, h) / 200} strokeLinejoin="round" />
      ))}
      {line ? (
        <polyline
          points={line.map((p) => `${p[0] - x0 + pad},${sy(p[1])}`).join(' ')}
          fill="none"
          stroke="var(--canvas-piezo)"
          strokeWidth={Math.max(w, h) / 120}
          strokeDasharray={`${Math.max(w, h) / 40} ${Math.max(w, h) / 80}`}
        />
      ) : null}
    </svg>
  );
}

/** Equivalencia entre el ángulo y la pendiente H:V, como ayuda del campo que no se está editando. */
function equivalence(form: SlopeForm): string | null {
  const r = slopeFromForm(form);
  if (!r.ok) return null;
  if (r.value.slope.kind === 'angle') return `Equivale a ${formatNumber(Number((1 / Math.tan((r.value.slope.degrees * Math.PI) / 180)).toPrecision(4)))}H:1V.`;
  return `Equivale a β = ${formatNumber(Number(((Math.atan(1 / r.value.slope.horizontal) * 180) / Math.PI).toPrecision(4)))}°.`;
}

/** Ayuda del campo del contacto: la cota resultante, para ver a qué altura queda respecto del pie. */
function contactHint(form: SlopeForm, input: SlopeInput | null): string | undefined {
  if (!input?.lower) return undefined;
  const y = contactElevation(input.lower.contact);
  const len = unitLabels(form.units).length;
  return `El contacto queda en y = ${formatNumber(y)} ${len} (el pie está en y = 0).`;
}

export function NewSlopeDialog({ initialUnits = 'SI', onCancel, onCreate }: {
  initialUnits?: 'SI' | 'imperial';
  onCancel: () => void;
  /** Resuelve a `false` si no se creó (p. ej. el usuario no confirmó descartar los cambios): el diálogo sigue abierto. */
  onCreate: (input: SlopeInput) => boolean | Promise<boolean>;
}) {
  const [form, setForm] = useState<SlopeForm>(() => slopeFormDefaults(initialUnits));
  const outcome = useMemo(() => slopeFromForm(form), [form]);
  const errors = outcome.ok ? {} : outcome.errors;
  const u = unitLabels(form.units);
  const set = <K extends keyof SlopeForm>(key: K, value: SlopeForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const water = WATER_CHOICES.find((w) => w.value === form.water) ?? WATER_CHOICES[0]!;
  const shape = equivalence(form);

  return (
    <Modal title="Talud simple" onCancel={onCancel}>
      <form
        className="ns-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (outcome.ok) void Promise.resolve(onCreate(outcome.value)).then((created) => created && onCancel());
        }}
        noValidate
      >
        <p className="muted small">
          Crea un modelo nuevo con un talud de uno o dos materiales (con estrato inferior), una búsqueda de superficie crítica y el sentido del deslizamiento de izquierda a derecha.
          Reemplaza el modelo actual.
        </p>
        <div className="ns-layout">
          <div className="ns-fields">
            <label className="field ep-field">
              <span>Unidades</span>
              <select value={form.units} onChange={(e) => setForm(slopeFormDefaults(e.target.value === 'imperial' ? 'imperial' : 'SI'))}>
                <option value="SI">SI (m, kN/m³, kPa)</option>
                <option value="imperial">Imperial (ft, pcf, psf)</option>
              </select>
            </label>
            <div className="ep-grid">
              <LabeledField label="Altura H" unit={u.length} value={form.height} error={errors.height} onChange={(v) => set('height', v)} />
              <LabeledField label="Ancho de corona" unit={u.length} value={form.crown} error={errors.crown} onChange={(v) => set('crown', v)} />
              <LabeledField label="Ancho de pie" unit={u.length} value={form.toe} error={errors.toe} onChange={(v) => set('toe', v)} />
              <LabeledField label="Profundidad bajo el pie" unit={u.length} value={form.depth} error={errors.depth} onChange={(v) => set('depth', v)} />
            </div>
            <fieldset className="ns-group">
              <legend>Inclinación del talud</legend>
              <div className="ep-radios">
                <label>
                  <input type="radio" name="ns-mode" checked={form.mode === 'angle'} onChange={() => set('mode', 'angle')} />
                  Ángulo β
                </label>
                <label>
                  <input type="radio" name="ns-mode" checked={form.mode === 'ratio'} onChange={() => set('mode', 'ratio')} />
                  Pendiente H:V
                </label>
              </div>
              {form.mode === 'angle' ? (
                <LabeledField label="Ángulo β" unit="°" value={form.angle} error={errors.angle} hint={shape ?? undefined} onChange={(v) => set('angle', v)} />
              ) : (
                <LabeledField
                  label="Pendiente H:V (horizontal por 1 vertical)"
                  value={form.ratio}
                  error={errors.ratio}
                  hint={shape ?? undefined}
                  onChange={(v) => set('ratio', v)}
                />
              )}
            </fieldset>
            <fieldset className="ns-group">
              <legend>Material</legend>
              <div className="ep-grid">
                <LabeledField label="Nombre" mode="text" value={form.name} onChange={(v) => set('name', v)} />
                <LabeledField label="Peso unitario γ" unit={u.unitWeight} value={form.unit_weight} error={errors.unit_weight} onChange={(v) => set('unit_weight', v)} />
                <LabeledField label="Cohesión c" unit={u.stress} value={form.cohesion} error={errors.cohesion} onChange={(v) => set('cohesion', v)} />
                <LabeledField label="Ángulo de fricción φ" unit="°" value={form.friction_angle} error={errors.friction_angle} onChange={(v) => set('friction_angle', v)} />
              </div>
            </fieldset>
            <fieldset className="ns-group" data-testid="slope-lower">
              <legend>Estrato inferior</legend>
              <label className="ns-check">
                <input type="checkbox" checked={form.lowerOn} onChange={(e) => set('lowerOn', e.target.checked)} />
                Agregar un estrato inferior (material 2)
              </label>
              {form.lowerOn ? (
                <>
                  <div className="ep-radios">
                    <label>
                      <input type="radio" name="ns-contact" checked={form.lowerMode === 'depth'} onChange={() => set('lowerMode', 'depth')} />
                      Dar la profundidad del contacto
                    </label>
                    <label>
                      <input type="radio" name="ns-contact" checked={form.lowerMode === 'elevation'} onChange={() => set('lowerMode', 'elevation')} />
                      Dar la cota del contacto
                    </label>
                  </div>
                  <LabeledField
                    label={form.lowerMode === 'depth' ? 'Contacto: profundidad bajo el pie' : 'Contacto: cota y (el pie está en 0)'}
                    unit={u.length}
                    value={form.lowerContact}
                    error={errors.lowerContact}
                    hint={contactHint(form, outcome.ok ? outcome.value : null)}
                    onChange={(v) => set('lowerContact', v)}
                  />
                  <div className="ep-grid">
                    <LabeledField label="Estrato inferior: nombre" mode="text" value={form.lowerName} onChange={(v) => set('lowerName', v)} />
                    <LabeledField label="Estrato inferior: peso unitario γ" unit={u.unitWeight} value={form.lowerUnitWeight} error={errors.lowerUnitWeight} onChange={(v) => set('lowerUnitWeight', v)} />
                    <LabeledField label="Estrato inferior: cohesión c" unit={u.stress} value={form.lowerCohesion} error={errors.lowerCohesion} onChange={(v) => set('lowerCohesion', v)} />
                    <LabeledField label="Estrato inferior: ángulo de fricción φ" unit="°" value={form.lowerFriction} error={errors.lowerFriction} onChange={(v) => set('lowerFriction', v)} />
                  </div>
                </>
              ) : (
                <p className="muted small">El talud tendrá un solo material. Con un estrato inferior se crean dos regiones que comparten el contacto horizontal.</p>
              )}
            </fieldset>
            <label className="field ep-field">
              <span>Línea piezométrica</span>
              <select value={form.water} onChange={(e) => set('water', e.target.value as SlopeWater)} aria-describedby="ns-water-hint">
                {WATER_CHOICES.map((w) => (
                  <option key={w.value} value={w.value}>
                    {w.label}
                  </option>
                ))}
              </select>
              <span id="ns-water-hint" className="muted small">
                {water.hint}
              </span>
            </label>
          </div>
          <div className="ns-side">
            <Preview input={outcome.ok ? outcome.value : null} />
          </div>
        </div>
        <div className="ep-actions ns-actions">
          <button type="submit" className="primary" disabled={!outcome.ok}>
            Crear talud
          </button>
          <button type="button" onClick={onCancel}>
            Cancelar
          </button>
          {!outcome.ok ? <span className="muted small">Corrija los campos marcados para crear el talud.</span> : null}
        </div>
      </form>
    </Modal>
  );
}
