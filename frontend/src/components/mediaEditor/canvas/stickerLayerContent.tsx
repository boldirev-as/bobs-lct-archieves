import {Accessor, onCleanup, onMount} from 'solid-js';

import createMiddleware from '../../../helpers/solid/createMiddleware';
import wrapSticker from '../../wrappers/sticker';

import {useMediaEditorContext} from '../context';
import {NumberPair, ResizableLayerProps} from '../types';

import {ResizableContainer} from './resizableLayers';

interface StickerLayerContentProps extends ResizableLayerProps {
  canvasSize: NumberPair;
  finalTransform: {
    flip: NumberPair;
    rotation: number;
    scale: number;
    translation: NumberPair;
  };
  pixelRatio: number;
  selectedLayerId?: number;
  resizeHandlesContainer?: HTMLDivElement;
}

export default function StickerLayerContent(props: StickerLayerContentProps) {
  const {editorState} = useMediaEditorContext();

  let container: HTMLDivElement;

  onMount(() => {
    const middleware = createMiddleware();

    wrapSticker({
      div: container,
      doc: props.layer.sticker,
      group: 'none',
      width: 500,
      height: 500,
      play: true,
      loop: true,
      withThumb: false,
      middleware: middleware.get()
    });

    editorState.stickersLayersInfo[props.layer.id] = {container};

    onCleanup(() => {
      middleware.destroy();
    });
  });

  const children = (
    <div ref={container} class="media-editor__sticker-layer-content" />
  ); // Needs to be rendered here for hot reload to work properly

  return (
    <ResizableContainer 
      layer={props.layer}
      canvasSize={props.canvasSize}
      finalTransform={props.finalTransform}
      pixelRatio={props.pixelRatio}
      selectedLayerId={props.selectedLayerId}
      resizeHandlesContainer={props.resizeHandlesContainer}
    >
      {children}
    </ResizableContainer>
  );
}
