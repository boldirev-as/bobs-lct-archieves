
const arrays = {
  8: new Uint8Array(1),
  16: new Uint16Array(1),
  32: new Uint32Array(1)
};
export function nextRandomUint(bits: 8 | 16 | 32) {
  const array = arrays[bits];
  crypto.getRandomValues(array);
  return array[0];
}

export function randomLong() {
  return '' + nextRandomUint(32) + nextRandomUint(32) % 0xFFFFFF;
}
