// Descargas desde el navegador (Blob + a[download]).

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function downloadText(text: string, fileName: string, mime: string): void {
  // El BOM hace que Excel abra el CSV en UTF-8; no se agrega al JSON.
  const parts = mime.startsWith('text/csv') ? ['\ufeff', text] : [text];
  downloadBlob(new Blob(parts, { type: mime }), fileName);
}
