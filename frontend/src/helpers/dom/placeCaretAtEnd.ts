
import IS_TOUCH_SUPPORTED from '../../environment/touchSupport';

export default function placeCaretAtEnd(el: HTMLElement, ignoreTouchCheck = false, focus = true) {
  if(IS_TOUCH_SUPPORTED && (!ignoreTouchCheck || (document.activeElement.tagName !== 'INPUT' && !(document.activeElement as HTMLElement).isContentEditable))) {
    return;
  }

  focus && el.focus();
  if(el instanceof HTMLInputElement) {
    const length = el.value.length;
    el.selectionStart = length;
    el.selectionEnd = length;
  } else {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

(window as any).placeCaretAtEnd = placeCaretAtEnd;
