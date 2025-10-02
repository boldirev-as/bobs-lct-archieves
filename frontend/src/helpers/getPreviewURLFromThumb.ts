
import type {MyDocument} from '../lib/appManagers/appDocsManager';
import type {MyPhoto} from '../lib/appManagers/appPhotosManager';
import {PhotoSize} from '../layer';
// import appDownloadManager from "../lib/appManagers/appDownloadManager";
import getPreviewURLFromBytes from './bytes/getPreviewURLFromBytes';

export default function getPreviewURLFromThumb(photo: MyPhoto | MyDocument, thumb: PhotoSize.photoCachedSize | PhotoSize.photoStrippedSize, isSticker = false) {
  // const cacheContext = appDownloadManager.getCacheContext(photo, thumb.type);
  // return cacheContext.url || (cacheContext.url = getPreviewURLFromBytes(thumb.bytes, isSticker));
  return getPreviewURLFromBytes(thumb.bytes, isSticker);
}
