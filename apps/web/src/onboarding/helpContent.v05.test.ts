// Ayuda de la grieta de tracción y el agua embalsada (F5.3, F5.4, F5.7, E15c): glosario y limitaciones del formato v0.5.
import { describe, expect, it } from 'vitest';
import { POND_NOTE } from '../report/crackReport';
import { GLOSSARY, LIMITATIONS, glossaryTerms } from './helpContent';

const entry = (id: string) => GLOSSARY.find((g) => g.id === id);

describe('glosario del agua embalsada y la grieta de tracción (v0.5)', () => {
  it('tiene «Agua embalsada» y «Grieta de tracción», con ids únicos', () => {
    expect(glossaryTerms()).toEqual(expect.arrayContaining(['Agua embalsada', 'Grieta de tracción']));
    expect(new Set(GLOSSARY.map((g) => g.id)).size).toBe(GLOSSARY.length);
  });
  it('el agua embalsada: sin campo, automática, la nota del motor, sin sismo y la regla de ru', () => {
    const def = entry('ponded-water')?.definition ?? '';
    expect(def).toContain('No tiene campo propio');
    expect(def).toContain(POND_NOTE);
    expect(def).toContain('ni kh ni kv');
    expect(def).toContain('u = ru · (W + V)/b');
    expect(def).toContain('relleno azul');
  });
  it('la grieta: posición x_c, masa truncada, Pw, fracción 1 conservadora y la profundidad automática', () => {
    const def = entry('tension-crack')?.definition ?? '';
    for (const t of ['x_c', 'cara vertical', 'tension_crack_not_reached', 'Pw = ½·γw·hw²', 'Slide2', 'USACE EM 1110-2-1902', 'Automática', 'no hay tope']) expect(def, t).toContain(t);
    expect(def).toContain('lo conservador');
  });
  it('la entrada de ru explica el volumen del agua embalsada y que es la regla conservadora', () => {
    const def = entry('ru')?.definition ?? '';
    expect(def).toContain('u = ru · (W + V)/b');
    expect(def).toContain('conservadora');
  });
  it('las limitaciones declaran el sismo sobre el agua, la regla de ru y el sentido de la fracción de agua', () => {
    const text = LIMITATIONS.join('\n');
    expect(text).toContain('water_above_ground');
    expect(text).toContain('no actúa sobre ella');
    expect(text).toContain('no se pudo contrastar');
    expect(text).toContain('fracción de agua 1');
    expect(text).toContain('reinforcement_outside_mass');
  });
  it('español neutro: sin voseo en la ayuda nueva', () => {
    const text = [entry('ponded-water')?.definition, entry('tension-crack')?.definition, ...LIMITATIONS].join(' ');
    expect(text).not.toMatch(/\b(tenés|podés|usá|hacé|fijate|mirá|elegí|ponés|sabés|querés)\b/i);
  });
});
