
import readBlobAs from './readBlobAs';

export default function readBlobAsText(blob: Blob) {
  return readBlobAs(blob, 'readAsText');
}
