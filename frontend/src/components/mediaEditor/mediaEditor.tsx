import {createEffect, onCleanup, onMount} from 'solid-js';
import {render} from 'solid-js/web';

import {doubleRaf} from '../../helpers/schedulers';
import type SolidJSHotReloadGuardProvider from '../../lib/solidjs/hotReloadGuardProvider';

import FilesSwiper from './filesSwiper';
import MediaEditorContext, {createContextValue, EditingMediaState} from './context';
import FinishButton from './finishButton';
import Toolbar from './toolbar';
import {MediaType, NumberPair} from './types';
import {delay, withCurrentOwner} from './utils';

import './mediaEditor.scss';

export type MediaEditorProps = {
  onClose: (hasGif: boolean) => void;
  onCanvasReady?: (canvas: HTMLCanvasElement) => Promise<void>; // Made optional
  onImageRendered: () => void;
  mediaSrc: string;
  mediaType: MediaType;
  mediaBlob: Blob;
  mediaSize: NumberPair;
  editingMediaState?: EditingMediaState
};

export function MediaEditor(props: MediaEditorProps) {
  const contextValue = createContextValue(props);

  const {hasModifications} = contextValue;

  let overlay: HTMLDivElement;

  onMount(() => {
    (async() => {
      overlay.classList.add('media-editor__overlay--hidden');
      await doubleRaf();
      overlay.classList.remove('media-editor__overlay--hidden');
    })();

    overlay.focus();
  });

  async function performClose(hasGif = false) {
    overlay.classList.add('media-editor__overlay--hidden');
    await delay(200);
    props.onClose(hasGif);
  }

  function handleClose(finished = false, hasGif = false) {
    if(finished || !hasModifications()) {
      performClose(hasGif);
      return;
    }

    return false;
  }

  let isFinishing = false;

  return (
    <MediaEditorContext.Provider value={contextValue}>
      <div ref={overlay} class="media-editor__overlay night">
        <div class="media-editor__container">
          {(() => {
            return (
              <>
                <FilesSwiper />
                <Toolbar onClose={handleClose} />
              </>
            );
          })()}
        </div>
      </div>
    </MediaEditorContext.Provider>
  );
}

export function openMediaEditor(props: MediaEditorProps, HotReloadGuardProvider: typeof SolidJSHotReloadGuardProvider) {
  const element = document.createElement('div');
  document.body.append(element);

  render(() => (
    <HotReloadGuardProvider>
      <MediaEditor {...props}/>
    </HotReloadGuardProvider>
  ), element);

}
