
import limitSymbols from '../../helpers/string/limitSymbols';
import {WebPage} from '../../layer';
import wrapRichText from '../../lib/richTextProcessor/wrapRichText';

export default function wrapWebPageTitle(webPage: WebPage.webPage) {
  let shortTitle = webPage.title || webPage.author || '';
  shortTitle = limitSymbols(shortTitle, 80, 100);
  return wrapRichText(shortTitle, {noLinks: true, noLinebreaks: true});
}
