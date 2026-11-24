// Mensajes legibles para los errores del motor (códigos de §3: OgsError).

export function humanizeEngineError(raw: string): string {
  const message = raw.trim();
  if (message.startsWith('NoSurface')) {
    return 'El modelo no define una superficie fija ni una búsqueda de superficie crítica.';
  }
  if (message.startsWith('NoValidSurface')) {
    return 'La búsqueda no encontró ninguna superficie de deslizamiento válida.';
  }
  if (message.startsWith('InvalidModel')) {
    return `Modelo no válido: ${message.replace(/^InvalidModel:?\s*/, '')}`;
  }
  if (message.startsWith('Json')) {
    return `JSON no válido: ${message.replace(/^Json:?\s*/, '')}`;
  }
  return `Error del motor: ${message}`;
}
