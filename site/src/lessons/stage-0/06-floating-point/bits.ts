/**
 * A NUMBER, AS THE MACHINE KEEPS IT. JavaScript's numbers are "doubles" (IEEE 754, 64 bits): one
 * bit for the sign, 11 for the exponent (the power of two) and 52 for the fraction (the digits).
 * Rapier, and the graphics card, count with "floats": 32 bits (1 + 8 + 23).
 */
const view = new DataView(new ArrayBuffer(8));

/** The 64 bits of a number: sign | exponent | fraction. */
export function bitsOf(x: number): string {
  view.setFloat64(0, x);
  let bits = '';
  for (let i = 0; i < 8; i++) bits += view.getUint8(i).toString(2).padStart(8, '0');
  return `${bits.slice(0, 1)} ${bits.slice(1, 12)} ${bits.slice(12)}`;
}

/**
 * How far from `x` (positive) the next number the machine can keep is: in 64 or in 32 bits. Between
 * the two there is nothing, so every result in between is rounded to one of them. Adding 1 to the
 * bits gives the next number: the fraction counts up, and when it is full the exponent goes up.
 */
export function spacing(x: number, bits: 32 | 64): number {
  if (bits === 32) {
    view.setFloat32(0, x);
    const here = view.getFloat32(0);
    view.setUint32(0, view.getUint32(0) + 1);
    return view.getFloat32(0) - here;
  }
  view.setFloat64(0, x);
  view.setBigUint64(0, view.getBigUint64(0) + 1n);
  return view.getFloat64(0) - x;
}
