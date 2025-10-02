
import {MOUNT_CLASS_TO} from '../config/debug';
import {makeMediaSize} from './mediaSize';

export default function calcImageInBox(imageW: number, imageH: number, boxW: number, boxH: number, noZoom = true) {
  if(imageW < boxW && imageH < boxH && noZoom) {
    return makeMediaSize(imageW, imageH);
  }

  let boxedImageW = boxW;
  let boxedImageH = boxH;

  if((imageW / imageH) > (boxW / boxH)) {
    boxedImageH = (imageH * boxW / imageW) | 0;
  } else {
    boxedImageW = (imageW * boxH / imageH) | 0;
    if(boxedImageW > boxW) {
      boxedImageH = (boxedImageH * boxW / boxedImageW) | 0;
      boxedImageW = boxW;
    }
  }

  if(noZoom && boxedImageW >= imageW && boxedImageH >= imageH) {
    boxedImageW = imageW;
    boxedImageH = imageH;
  }

  return makeMediaSize(boxedImageW, boxedImageH);
}

MOUNT_CLASS_TO.calcImageInBox = calcImageInBox;
