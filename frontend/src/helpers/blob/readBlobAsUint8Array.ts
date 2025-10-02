
import readBlobAsArrayBuffer from './readBlobAsArrayBuffer';

export default function readBlobAsUint8Array(blob: Blob) {
  return readBlobAsArrayBuffer(blob).then((buffer) => new Uint8Array(buffer));
}
