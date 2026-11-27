/** Hoek, Carranza-Torres y Corkum (2002), ecuaciones 3 a 5. */
export function hoekBrownParameters(gsi: number, mi: number, disturbance: number): { mb: number; s: number; a: number } {
  return {
    mb: mi * Math.exp((gsi - 100) / (28 - 14 * disturbance)),
    s: Math.exp((gsi - 100) / (9 - 3 * disturbance)),
    a: 0.5 + (Math.exp(-gsi / 15) - Math.exp(-20 / 3)) / 6,
  };
}
