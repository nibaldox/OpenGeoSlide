// R7-28: la confirmación de descarte va antes de los avisos del archivo; leer un archivo nunca deja una promesa sin capturar.
import { describe, expect, it, vi } from 'vitest';
import { saveOgsJson } from '../../io/ogsJson';
import type { Issue } from '../types';
import { newDoc } from './docTemplates';
import { readOpenFile, readTextFile } from './openFile';

const file = (name: string, text: () => Promise<string>) => ({ name, text });
const aviso: Issue = { source: 'local', severity: 'aviso', code: 'x', text: 'Se ignoró un campo.', path: null };

describe('readOpenFile', () => {
  it('si el usuario cancela el descarte, no queda ningún aviso del archivo que no se abrió', async () => {
    const confirmDiscard = vi.fn(() => false);
    const open = vi.fn(() => ({ doc: newDoc(), issues: [aviso] }));
    const r = await readOpenFile(file('a.ogs.json', async () => '{}'), confirmDiscard, open);
    expect(confirmDiscard).toHaveBeenCalledTimes(1);
    expect(r.doc).toBeNull();
    expect(r.notices).toEqual([]);
  });
  it('si el usuario confirma, devuelve el documento y los avisos con el nombre del archivo', async () => {
    const r = await readOpenFile(file('a.ogs.json', async () => saveOgsJson(newDoc())), () => true, () => ({ doc: newDoc(), issues: [aviso] }));
    expect(r.doc).not.toBeNull();
    expect(r.notices).toEqual([{ kind: 'aviso', text: 'a.ogs.json: Se ignoró un campo.' }]);
  });
  it('un archivo rechazado muestra sus errores sin pedir confirmación (no hay nada que descartar)', async () => {
    const confirmDiscard = vi.fn(() => true);
    const err: Issue = { source: 'local', severity: 'error', code: 'e', text: 'No es un modelo.', path: null };
    const r = await readOpenFile(file('b.json', async () => 'x'), confirmDiscard, () => ({ doc: null, issues: [err] }));
    expect(confirmDiscard).not.toHaveBeenCalled();
    expect(r.doc).toBeNull();
    expect(r.notices).toEqual([{ kind: 'error', text: 'b.json: No es un modelo.' }]);
  });
  it('si file.text() falla, devuelve un aviso de error en lugar de lanzar', async () => {
    const r = await readOpenFile(file('c.json', () => Promise.reject(new Error('permiso denegado'))), () => true);
    expect(r.doc).toBeNull();
    expect(r.notices).toHaveLength(1);
    expect(r.notices[0]).toMatchObject({ kind: 'error' });
    expect(r.notices[0]?.text).toContain('c.json');
    expect(r.notices[0]?.text).toContain('permiso denegado');
  });
});

describe('readTextFile', () => {
  it('devuelve el texto', async () => {
    expect(await readTextFile(file('d.dxf', async () => 'abc'))).toEqual({ ok: true, text: 'abc' });
  });
  it('si la lectura falla, devuelve el error como aviso (R7-28)', async () => {
    const r = await readTextFile(file('d.dxf', () => Promise.reject(new Error('disco'))));
    expect(r).toMatchObject({ ok: false });
    expect(r.ok === false && r.notice.text).toContain('d.dxf');
    expect(r.ok === false && r.notice.kind).toBe('error');
  });
});
