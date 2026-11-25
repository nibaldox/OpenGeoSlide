// Pista de exportación (R8 B-06): «Pulse «Comprobar» para habilitar las exportaciones…». En el estado inicial el resumen de
// resultados ya dice «Sin resultados. Pulse «Comprobar»…»: repetirlo era ruido. La pista aparece solo cuando hay un resultado
// obsoleto (el modelo cambió desde el último cálculo) o cuando el usuario intenta exportar sin resultado.

export interface ExportHintInput {
  /** Texto de la pista que calcula `exportAvailability` (`undefined` = no hace falta). */
  hint: string | undefined;
  /** Hay un resultado (de este modelo o de uno anterior). */
  hasRun: boolean;
  /** El resultado corresponde a la revisión actual del modelo. */
  current: boolean;
  /** El usuario abrió «Exportar» o pulsó «Informe PDF» sin resultado vigente. */
  attempted: boolean;
}

/** Texto de la pista visible, o `undefined` si no debe mostrarse. */
export function visibleExportHint({ hint, hasRun, current, attempted }: ExportHintInput): string | undefined {
  if (!hint) return undefined;
  // Sin resultado alguno, el resumen ya lo dice: la pista espera a que se intente exportar. Con un resultado (obsoleto, o vigente
  // pero sin superficie que exportar) la pista aporta lo que el resumen no dice.
  void current;
  return hasRun || attempted ? hint : undefined;
}
