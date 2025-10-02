
export default function setRichFocus(field: HTMLElement, selectNode: Node, noCollapse?: boolean) {
  field.focus();
  if(selectNode &&
    selectNode.parentNode == field &&
    !selectNode.nextSibling &&
    !noCollapse) {
    field.removeChild(selectNode);
    selectNode = null;
  }

  if(window.getSelection && document.createRange) {
    const range = document.createRange();
    if(selectNode) {
      range.selectNode(selectNode);
    } else {
      range.selectNodeContents(field);
    }

    if(!noCollapse) {
      range.collapse(false);
    }

    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
  /* else if (document.body.createTextRange !== undefined) {
    var textRange = document.body.createTextRange()
    textRange.moveToElementText(selectNode || field)
    if (!noCollapse) {
      textRange.collapse(false)
    }
    textRange.select()
  } */
}
