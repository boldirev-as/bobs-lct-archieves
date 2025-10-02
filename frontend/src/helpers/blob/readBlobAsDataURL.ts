
import readBlobAs from './readBlobAs';

export default function readBlobAsDataURL(blob: Blob) {
  return readBlobAs(blob, 'readAsDataURL');
}
