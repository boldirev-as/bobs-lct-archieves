
import clearMessageId from './clearMessageId';

/**
 * * will ignore outgoing offset
 */
export default function getServerMessageId(messageId: number) {
  return clearMessageId(messageId, true);
}
