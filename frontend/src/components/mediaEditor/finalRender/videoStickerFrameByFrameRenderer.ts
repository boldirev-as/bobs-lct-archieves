import deferredPromise, {CancellablePromise} from '../../../helpers/cancellablePromise';
import {getMiddleware} from '../../../helpers/middleware';
import {Document} from '../../../layer';
import {IS_FIREFOX} from '../../../environment/userAgent';

import {StickerFrameByFrameRenderer} from './types';
import {FRAMES_PER_SECOND} from './constants';

export default class VideoStickerFrameByFrameRenderer implements StickerFrameByFrameRenderer {
  private duration: number = 0;
  private currentDeferredFrame: CancellablePromise<void>;
  private video: HTMLVideoElement;

  private middleware = getMiddleware();

  async init(doc: Document.document) {
  }

  getTotalFrames() {
    return IS_FIREFOX ? 1 : Math.floor(this.duration * FRAMES_PER_SECOND);
  }

  async renderFrame(frame: number) {
    if(IS_FIREFOX) return;
    this.currentDeferredFrame = deferredPromise<void>();
    this.video.currentTime = (1 / FRAMES_PER_SECOND) * frame;
    await this.currentDeferredFrame;
  }

  getRatio() {
    return this.video.videoWidth / this.video.videoHeight;
  }

  getRenderedFrame() {
    return this.video;
  }

  destroy() {
    this.middleware.destroy();
    this.video = null;
  }
}
