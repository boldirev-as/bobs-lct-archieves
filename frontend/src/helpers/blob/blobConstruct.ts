
import toArray from '../array/toArray';
import blobSafeMimeType from './blobSafeMimeType';

export default function blobConstruct<T extends Uint8Array | string>(blobParts: Array<T> | T, mimeType: string = ''): Blob {
  blobParts = toArray(blobParts);
  const safeMimeType = blobSafeMimeType(mimeType);
  const blob = new Blob(blobParts, {type: safeMimeType});
  return blob;
}
