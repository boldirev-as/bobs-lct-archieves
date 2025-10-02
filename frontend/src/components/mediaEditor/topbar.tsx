import {batch, onCleanup, onMount} from 'solid-js';

import {addShortcutListener} from '../../helpers/shortcutListener';
import {ButtonIconTsx} from '../buttonIconTsx';
import ripple from '../ripple';

import {HistoryItem, useMediaEditorContext} from './context';
import {processHistoryItem} from './utils';

export default function Topbar(props: {onClose: () => void}) {
  const {hasModifications, mediaState, editorState} = useMediaEditorContext();

  let doneButton: HTMLDivElement;

  // function processHistory(history: HistoryItem[], otherHistory: HistoryItem[]) {
  //   batch(() => {
  //     const item = history.pop();
  //     if(!item) return;

  //     otherHistory.push({
  //       ...item,
  //       path: item.path,
  //       newValue: item.oldValue,
  //       oldValue: item.newValue
  //     });

  //     processHistoryItem(item, mediaState);

  //     // Clear selected layer for current file
  //     const currentFile = editorState.targetFile;
  //     if (currentFile) {
  //       currentFile.selectedResizableLayer = undefined;
  //     }
  //   });
  // }

  // function onUndo() {
  //   processHistory(mediaState.history, mediaState.redoHistory);
  // }

  // function onRedo() {
  //   processHistory(mediaState.redoHistory, mediaState.history);
  // }

  // onMount(() => {
  //   ripple(doneButton);

  //   const removeListener = addShortcutListener(['Ctrl+KeyZ', 'Ctrl+Shift+KeyZ', 'Ctrl+KeyY'], (combo) => {
  //     if(combo === 'Ctrl+KeyZ') {
  //       onUndo();
  //     } else {
  //       onRedo();
  //     }
  //   });

  //   onCleanup(() => removeListener());
  // });

  return (
    <div class="media-editor__topbar">
      <ButtonIconTsx icon="back" onClick={props.onClose} />
      <div class="media-editor__topbar-title">Редактировать</div>
      {/* <div class="media-editor__topbar-history-controls">
        <ButtonIconTsx disabled={!mediaState.history.length} onClick={onUndo} icon="undo" />
        <ButtonIconTsx disabled={!mediaState.redoHistory.length} onClick={onRedo} icon="redo" />
      </div> */}
    </div>
  );
}
