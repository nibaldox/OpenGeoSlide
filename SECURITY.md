# Política de seguridad

## Versiones con soporte

OpenGeoSlide está en desarrollo (versión 0.x). Solo recibe correcciones de seguridad la última versión publicada y la
rama `main`.

## Cómo informar de una vulnerabilidad

**No abra un issue público** para informar de una vulnerabilidad.

Use el aviso privado de seguridad de GitHub: pestaña **Security** del repositorio, **Report a vulnerability**. Incluya:

- la versión o el commit afectado y el componente (`ogs-core`, `ogs-cli`, `ogs-wasm`, `ogs-py`, aplicación web);
- los pasos para reproducirlo, con un modelo `.ogs.json` mínimo si procede;
- el impacto que usted estima.

Los mantenedores acusarán recibo en un plazo de 7 días y darán una primera valoración en 14 días. Se pide divulgación
coordinada: no publique los detalles hasta que haya una corrección disponible o hayan pasado 90 días desde el aviso.

## Alcance

Entran en el alcance, entre otros:

- entradas maliciosas (`.ogs.json`, DXF, CSV) que provoquen pánico, bloqueo, consumo desmedido de memoria o ejecución
  de código en el motor, en la CLI, en el módulo WASM o en el paquete de Python;
- fallos de la aplicación web (inyección de contenido, service worker) y de la cadena de publicación (workflows).

**Fuera del alcance:** los resultados numéricos incorrectos o poco conservadores no son una vulnerabilidad de seguridad;
abra un issue con el caso (ver `CONTRIBUTING.md`). Recuerde que OpenGeoSlide no sustituye el criterio de un ingeniero
geotécnico.

## Cadena de suministro

- El `Cargo.lock` y el `pnpm-lock.yaml` están versionados y CI instala con `--locked` y `--frozen-lockfile`.
- Los wheels se publican en PyPI con Trusted Publishing (OIDC), sin tokens de larga vida.
