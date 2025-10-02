
import {InputPhoto} from '../../../../layer';
import {MyPhoto} from '../../appPhotosManager';

export default function getPhotoInput(photo: MyPhoto): InputPhoto.inputPhoto {
  return {
    _: 'inputPhoto',
    id: photo.id,
    access_hash: photo.access_hash,
    file_reference: photo.file_reference
  };
}
