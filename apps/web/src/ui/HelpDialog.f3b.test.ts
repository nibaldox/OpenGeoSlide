// F3B-W2: `HelpDialog.tsx` renderiza las tres entradas nuevas del glosario y la Tabla 1 de Hoek et al. (2002) de forma accesible.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HOEK_BROWN_D_TABLE } from '../onboarding/helpContent';
import { HelpDialog } from './HelpDialog';

describe('HelpDialog con contenido F3B', () => {
  it('renderiza «Hoek-Brown» con la Tabla 1 accesible (`<caption>` y `<th scope>`), «SHANSEP» y «Búsqueda no circular»', () => {
    const html = renderToStaticMarkup(createElement(HelpDialog, { onClose: () => undefined, onStartTour: () => undefined }));
    expect(html).toContain('<dt>Hoek-Brown</dt>');
    expect(html).toContain('<dt>SHANSEP</dt>');
    expect(html).toContain('<dt>Búsqueda no circular</dt>');
    expect(html).toContain(HOEK_BROWN_D_TABLE.caption);
    expect(html).toContain('<th scope="col">D sugerido</th>');
    expect(html).toContain('<th scope="col">Condición de excavación o voladura</th>');
    expect(html).toContain('<th scope="row">0,7</th>');
    expect(html).toContain('<th scope="row">1,0</th>');
  });
});
