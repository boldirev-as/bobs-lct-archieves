
import {InputMedia} from '../../../../layer';
import {MyPhoto} from '../../appPhotosManager';
import getPhotoInput from './getPhotoInput';

export default function getPhotoMediaInput(photo: MyPhoto): InputMedia.inputMediaPhoto {
  return {
    _: 'inputMediaPhoto',
    id: getPhotoInput(photo),
    ttl_seconds: 0,
    pFlags: {}
  };
}
