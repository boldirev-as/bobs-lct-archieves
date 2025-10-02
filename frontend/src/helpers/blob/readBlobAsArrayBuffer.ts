
import readBlobAs from './readBlobAs';

export default function readBlobAsArrayBuffer(blob: Blob) {
  return readBlobAs(blob, 'readAsArrayBuffer');
}
