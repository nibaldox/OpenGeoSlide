// Ayuda de la v0.3 (F3.9): glosario de M-P, función de interfaz, Janbu y f₀, Su y polilínea, y las limitaciones nuevas.
import { describe, expect, it } from 'vitest';
import { GLOSSARY, LIMITATIONS, glossaryTerms } from './helpContent';

const entry = (id: string) => GLOSSARY.find((g) => g.id === id);

describe('glosario de la v0.3', () => {
  it('tiene las cinco entradas nuevas, con ids únicos', () => {
    for (const id of ['morgenstern-price', 'interslice-function', 'janbu', 'su', 'polyline']) expect(entry(id), id).toBeDefined();
    expect(new Set(GLOSSARY.map((g) => g.id)).size).toBe(GLOSSARY.length);
    expect(glossaryTerms()).toEqual(expect.arrayContaining(['Morgenstern-Price (M-P)', 'Función de interfaz f(ξ)', 'Su (resistencia no drenada)', 'Superficie polilínea']));
  });

  it('la función de interfaz nombra las cinco funciones con las etiquetas de F3.9', () => {
    const def = entry('interslice-function')?.definition ?? '';
    for (const label of ['«Constante»', '«Medio seno»', '«Seno recortado (mín. 0,35)»', '«Trapezoidal (20 %-80 %)»', '«Definida por puntos»']) expect(def).toContain(label);
    expect(def).toContain('ξ creciente de 0 a 1');
  });

  it('Janbu explica F₀, f₀ y b₁ con los tres valores', () => {
    const def = entry('janbu')?.definition ?? '';
    expect(def).toContain('F₀');
    expect(def).toContain('f₀ = 1 + b₁·(d/L − 1,4·(d/L)²)');
    for (const v of ['0,69', '0,31', '0,50']) expect(def).toContain(v);
  });

  it('Su explica el perfil con la cota (una cota, no una profundidad), el límite y las unidades del gradiente', () => {
    const def = entry('su')?.definition ?? '';
    expect(def).toContain('cota de referencia');
    expect(def).toContain('no una profundidad');
    expect(def).toContain('kPa/m o psf/ft');
    expect(def).toContain('ru no cambia la resistencia');
  });

  it('la polilínea dice qué métodos se ofrecen y que Bishop no', () => {
    const def = entry('polyline')?.definition ?? '';
    expect(def).toContain('Spencer, Morgenstern-Price y Janbu');
    expect(def).toContain('Bishop no');
  });
});

describe('limitaciones de la v0.3', () => {
  it('incluye «Bishop no se ofrece en superficies no circulares»', () => {
    expect(LIMITATIONS.some((l) => l.startsWith('Bishop no se ofrece en superficies no circulares'))).toBe(true);
  });
  it('ya no dice que todas las superficies son circulares ni que el material es solo Mohr-Coulomb', () => {
    expect(LIMITATIONS.join(' ')).not.toContain('Las superficies de deslizamiento son circulares');
    expect(LIMITATIONS[0]).toContain('no drenado');
    expect(LIMITATIONS.some((l) => l.includes('búsqueda') && l.includes('polilínea'))).toBe(true);
  });
});
