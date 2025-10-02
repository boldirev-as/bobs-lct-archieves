
import PeerTitle, {PeerTitleOptions} from '../peerTitle';

export default async function wrapPeerTitle(options: PeerTitleOptions) {
  const peerTitle = new PeerTitle();
  await peerTitle.update(options);
  return peerTitle.element;
}
