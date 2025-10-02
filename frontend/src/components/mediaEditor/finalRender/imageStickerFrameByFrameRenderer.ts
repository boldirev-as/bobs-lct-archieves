import deferredPromise from '../../../helpers/cancellablePromise';
import {Document} from '../../../layer';

import {StickerFrameByFrameRenderer} from './types';

export default class ImageStickerFrameByFrameRenderer implements StickerFrameByFrameRenderer {
  private image: HTMLImageElement;

  async init(doc: Document.document) {
  }

  getTotalFrames() {
    return 1;
  }

  getRatio() {
    return this.image.naturalWidth / this.image.naturalHeight;
  }

  async renderFrame() {}

  getRenderedFrame() {
    return this.image;
  }

  destroy() {
    this.image = null;
  }
}
