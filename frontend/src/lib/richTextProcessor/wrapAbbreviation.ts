
import wrapEmojiText from './wrapEmojiText';
import getAbbreviation from './getAbbreviation';

export default function wrapAbbreviation(str: string, onlyFirst?: boolean) {
  const {text, entities} = getAbbreviation(str, onlyFirst);
  return wrapEmojiText(text, undefined, entities);
}
