
/* export function isInDOM(element: Element, parentNode?: HTMLElement): boolean {
  if(!element) {
    return false;
  }

  parentNode = parentNode || document.body;
  if(element === parentNode) {
    return true;
  }
  return isInDOM(element.parentNode as HTMLElement, parentNode);
} */
export default function isInDOM(element: Element): boolean {
  return !!element?.isConnected;
}
