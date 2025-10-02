
export default function cancelEvent(event?: Event) {
  event ||= window.event;
  if(event) {
    // 'input' event will have cancelable=false, but we still need to preventDefault
    // if(!event.cancelable) {
    //   return false;
    // }

    // @ts-ignore
    event = event.originalEvent || event;

    try {
      if(event.stopPropagation) event.stopPropagation();
      if(event.preventDefault) event.preventDefault();
      event.returnValue = false;
      event.cancelBubble = true;
    } catch(err) {}
  }

  return false;
}
