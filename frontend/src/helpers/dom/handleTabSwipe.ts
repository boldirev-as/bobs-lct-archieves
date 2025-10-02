
import {cancelContextMenuOpening} from './attachContextMenuListener';
import handleHorizontalSwipe, {SwipeHandlerHorizontalOptions} from './handleHorizontalSwipe';

export default function handleTabSwipe(options: SwipeHandlerHorizontalOptions) {
  return handleHorizontalSwipe({
    ...options,
    onSwipe: (xDiff, yDiff, e) => {
      xDiff *= -1;
      yDiff *= -1;

      if(Math.abs(xDiff) > 50) {
        options.onSwipe(xDiff, yDiff, e);
        cancelContextMenuOpening();

        return true;
      }
    }
  });
}
