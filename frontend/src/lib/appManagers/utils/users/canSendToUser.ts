
import {User} from '../../../../layer';
import {REPLIES_PEER_ID} from '../../../mtproto/mtproto_config';

export default function canSendToUser(user: User.user) {
  return !!(user && !user.pFlags.deleted && user.id.toPeerId() !== REPLIES_PEER_ID);
}
