
import getEmojiEntityFromEmoji from './getEmojiEntityFromEmoji';
import wrapRichText from './wrapRichText';

export default function wrapSingleEmoji(emoji: string) {
  return wrapRichText(emoji, {
    entities: [getEmojiEntityFromEmoji(emoji)]
  });
}
