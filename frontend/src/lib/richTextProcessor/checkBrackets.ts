
export default function checkBrackets(url: string) {
  var urlLength = url.length;
  var urlOpenBrackets = url.split('(').length - 1;
  var urlCloseBrackets = url.split(')').length - 1;
  while(urlCloseBrackets > urlOpenBrackets &&
    url.charAt(urlLength - 1) === ')') {
    url = url.substr(0, urlLength - 1)
    urlCloseBrackets--;
    urlLength--;
  }
  if(urlOpenBrackets > urlCloseBrackets) {
    url = url.replace(/\)+$/, '');
  }
  return url;
}
