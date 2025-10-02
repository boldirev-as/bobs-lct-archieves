import deferredPromise, {CancellablePromise} from '../../../helpers/cancellablePromise';
import RLottiePlayer from '../../../lib/rlottie/rlottiePlayer';
import {Document} from '../../../layer';

import {StickerFrameByFrameRenderer} from './types';

export default class LottieStickerFrameByFrameRenderer implements StickerFrameByFrameRenderer {
  private frameCount: number = 0;
  private currentDeferredFrame: CancellablePromise<void>;
  private container: HTMLDivElement;
  private animation: RLottiePlayer;

  async init(doc: Document.document, size: number) {
  }

  getTotalFrames() {
    return this.frameCount;
  }

  getRatio() {
    return 1 / 1;
  }

  async renderFrame(frame: number) {
    this.currentDeferredFrame = deferredPromise<void>();
    this.animation.requestFrame(frame);
    await this.currentDeferredFrame;
  }

  getRenderedFrame() {
    return this.animation.canvas[0];
  }

  destroy() {
    this.container.remove();
    this.animation.remove();
  }
}
