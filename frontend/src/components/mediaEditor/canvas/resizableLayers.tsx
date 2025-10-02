import {Accessor, batch, createEffect, createMemo, For, on, onCleanup, onMount, ParentProps, Show} from 'solid-js';
import {createMutable, modifyMutable, produce} from 'solid-js/store';
import {Portal} from 'solid-js/web';

import createContextMenu from '../../../helpers/dom/createContextMenu';

import SwipeHandler, {getEvent} from '../../swipeHandler';
import {observeResize} from '../../resizeObserver';

import {NumberPair, ResizableLayer, ResizableLayerProps, UploadedFile} from '../types';
import {HistoryItem, useMediaEditorContext} from '../context';
import {withCurrentOwner, getCurrentFile} from '../utils';
import {syncLayerToOcr} from './syncLayerToOcr';
import useIsMobile from '../useIsMobile';

import StickerLayerContent from './stickerLayerContent';
import TextLayerContent from './textLayerContent';
import useProcessPoint from './useProcessPoint';
import useNormalizePoint from './useNormalizePoint';


type ProcessedLayer = {
  position: NumberPair;
  rotation: number;
  scale: number;
}

interface ResizableLayersProps {
  canvasSize: NumberPair;
  finalTransform: {
    flip: NumberPair;
    rotation: number;
    scale: number;
    translation: NumberPair;
  };
  pixelRatio: number;
  file?: UploadedFile;
  selectedLayerId?: number;
  resizeHandlesContainer?: HTMLDivElement;
}

export default function ResizableLayers(props: ResizableLayersProps) {
  const context = useMediaEditorContext();
  const {editorState, mediaState, actions} = context;
  const isTextTab = () => editorState.currentTab === 'text';
  const canClick = () => ['stickers', 'text', 'adjustments'].includes(editorState.currentTab);
  
  // Check if this is the active file
  const isActiveFile = createMemo(() => {
    const file = props.file || getCurrentFile(editorState, mediaState);
    return file && editorState.targetFile?.id === file.id;
  });
  
  // Get layers from the file passed via props
  const getCurrentFileLayers = () => {
    const targetFile = props.file || getCurrentFile(editorState, mediaState);
    
    if (targetFile) {
      // Initialize file layers if they don't exist
      if (!targetFile.textLayers) {
        targetFile.textLayers = [];
      }
      return targetFile.textLayers;
    }
    
    // Return empty array if no file
    return [];
  };

  // Простые функции для работы с координатами изображения
  const processPoint = (point: NumberPair): NumberPair => {
    // Просто возвращаем координаты как есть - они уже относительно изображения
    return point;
  };
  
  const normalizePoint = (point: NumberPair): NumberPair => {
    // Просто возвращаем координаты как есть - они уже в пикселях относительно изображения
    return point;
  };


  function moveSelectedLayerOnTop() {
    const layers = getCurrentFileLayers();
    const idx = layers.findIndex(layer => layer.id === props.selectedLayerId);
    if(idx < 0) return;
    const layer = layers.splice(idx, 1)[0];
    layer && layers.push(layer);
  }

  createEffect(
    on(() => props.selectedLayerId, () => {
      moveSelectedLayerOnTop();
    })
  );

  createEffect(() => {
    editorState.currentTab;
    onCleanup(() => {
      const file = props.file || getCurrentFile(editorState, mediaState);
      if (file) {
        file.selectedResizableLayer = undefined;
      }
    });
  });

  let container: HTMLDivElement;

  function addLayer(e: MouseEvent) {
    console.log('addLayer click:', e);
    if(e.target !== container) return;
    const file = props.file || getCurrentFile(editorState, mediaState);
    if(!file) return;
    
    if(file.selectedResizableLayer) {
      file.selectedResizableLayer = undefined;
      return;
    }

    if(true) return;

    const bcr = container.getBoundingClientRect();
    const transform = props.finalTransform;
    
    // Get click coordinates relative to container (screen coordinates)
    const screenX = e.clientX - bcr.left;
    const screenY = e.clientY - bcr.top;
    
    // Вычисляем uniformScale для преобразования в reference координаты
    const [canvasWidth, canvasHeight] = props.canvasSize;
    
    // Use file's referenceSize (original dimensions) instead of hardcoded 800x600
    const referenceSize = file.referenceSize || file.imageDimensions || [800, 600];
    const [referenceWidth, referenceHeight] = referenceSize;
    
    const scaleX = canvasWidth / referenceWidth;
    const scaleY = canvasHeight / referenceHeight;
    const uniformScale = Math.min(scaleX, scaleY);
    
    // Позиция в текущих координатах экрана
    const currentPosition: NumberPair = [screenX, screenY];
    
    // basePosition в reference координатах (800x600)
    const basePosition: NumberPair = [
      screenX / uniformScale,
      screenY / uniformScale
    ];
    
    console.log('addLayer click:', {
      clientCoords: [e.clientX, e.clientY],
      containerRect: bcr,
      screenCoords: [screenX, screenY],
      uniformScale: uniformScale,
      currentPosition: currentPosition,
      basePosition: basePosition
    });

    const newResizableLayer = {
      id: context.resizableLayersSeed++,
      position: currentPosition,
      basePosition: basePosition,
      rotation: -transform.rotation,
      scale: 1 / transform.scale,
      baseScale: 1 / transform.scale,
      width: 200,  // Начальная ширина
      height: 100, // Начальная высота
      baseWidth: 200,
      baseHeight: 100,
      type: 'text',
      textInfo: {...editorState.currentTextLayerInfo}
    } as ResizableLayer;

    batch(() => {
      const layers = getCurrentFileLayers();
      layers.push(newResizableLayer);
      file.selectedResizableLayer = newResizableLayer.id;

      // Note: History is now file-specific, could be implemented later
      // For now, we skip history for file-specific layers
    });
  }

  return (
    <div
      class="media-editor__resizable-layers"
      style={{
        cursor: 'default',
        'pointer-events': isActiveFile() ? 'auto' : 'none',
        'width': '100%',
        'height': '100%'
      }}
    >
      <div
        ref={container}
        class="media-editor__resizable-layers-inner"
        onClick={addLayer}
        style={{
          'pointer-events': isActiveFile() ? 'auto' : 'none',
          'width': '100%',
          'height': '100%'
        }}
      >
        <For each={getCurrentFileLayers()}>
          {(layer) => (
            <>
              <TextLayerContent 
                layer={layer}
                canvasSize={props.canvasSize}
                finalTransform={props.finalTransform}
                pixelRatio={props.pixelRatio}
                selectedLayerId={props.selectedLayerId}
                resizeHandlesContainer={props.resizeHandlesContainer}
              />
            </>
          )}
        </For>
      </div>
    </div>
  );
}

interface ResizableContainerProps extends ResizableLayerProps {
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

export function ResizableContainer(props: ParentProps<ResizableContainerProps>) {
  const {editorState, mediaState} = useMediaEditorContext();
  const isMobile = useIsMobile();
  
  // Простые функции для работы с координатами изображения
  const processPoint = (point: NumberPair): NumberPair => {
    // Просто возвращаем координаты как есть - они уже относительно изображения
    return point;
  };
  
  const normalizePoint = (point: NumberPair): NumberPair => {
    // Просто возвращаем координаты как есть - они уже в пикселях относительно изображения
    return point;
  };

  const handleTyping = (): HTMLDivElement | undefined => undefined;

  const store = createMutable({
    diff: [0, 0] as NumberPair,
    containerWidth: 0,
    containerHeight: 0,
    leftTopEl: handleTyping(),
    rightTopEl: handleTyping(),
    leftBottomEl: handleTyping(),
    rightBottomEl: handleTyping()
  });

  const circleOffset = () => (isMobile() ? '-6px' : '-4px');
  const processedLayer = createMemo(() => {
    return {
      position: props.layer.position, // Координаты в пикселях относительно изображения
      rotation: props.layer.rotation,
      scale: props.layer.scale
    };
  });


  let container: HTMLDivElement;

  onMount(() => {
    useResizeHandles({
      container,
      leftBottomEl: () => store.leftBottomEl,
      leftTopEl: () => store.leftTopEl,
      rightBottomEl: () => store.rightBottomEl,
      rightTopEl: () => store.rightTopEl,

      layer: props.layer,
      diff: store.diff,
      processedLayer,
      normalizePoint,
      finalTransform: props.finalTransform
    });

    useContextMenu({container, layer: props.layer});

    const unobserve = observeResize(container, () => {
      store.containerWidth = container.clientWidth;
      store.containerHeight = container.clientHeight;
    });

    onCleanup(() => {
      unobserve();
    });
  });

  return (
    <div
      class="media-editor__resizable-container"
      style={{
        'left': processedLayer().position[0] + store.diff[0] + 'px',
        'top': processedLayer().position[1] + store.diff[1] + 'px',
        'width': props.layer.width ? props.layer.width * processedLayer().scale + 'px' : 'auto',
        'height': props.layer.height ? props.layer.height * processedLayer().scale + 'px' : 'auto',
      }}
      onClick={() => {
        // Set selected layer in the file-specific state
        const file = getCurrentFile(editorState, mediaState);
        if (file) {
          file.selectedResizableLayer = props.layer.id;
        }
      }}
      ref={container}
    >
      {props.children}

      <Portal mount={props.resizeHandlesContainer}>
        <div
          class="media-editor__resizable-container-handles"
          style={{
            'left': processedLayer().position[0] + store.diff[0] + 'px',
            'top': processedLayer().position[1] + store.diff[1] + 'px',
            'width': props.layer.width * processedLayer().scale + 'px',
            'height': props.layer.height * processedLayer().scale + 'px',
          }}
        >
          <div
            class="media-editor__resizable-container-border media-editor__resizable-container-border--vertical"
            style={{left: 0}}
          />
          <div
            class="media-editor__resizable-container-border media-editor__resizable-container-border--vertical"
            style={{right: 0}}
          />
          <div
            class="media-editor__resizable-container-border media-editor__resizable-container-border--horizontal"
            style={{top: 0}}
          />
          <div
            class="media-editor__resizable-container-border media-editor__resizable-container-border--horizontal"
            style={{bottom: 0}}
          />
          <div
            ref={(el) => store.leftTopEl = el}
            class="media-editor__resizable-container-circle"
            style={{left: circleOffset(), top: circleOffset()}}
          />
          <div
            ref={(el) => store.rightTopEl = el}
            class="media-editor__resizable-container-circle"
            style={{right: circleOffset(), top: circleOffset()}}
          />
          <div
            ref={(el) => store.leftBottomEl = el}
            class="media-editor__resizable-container-circle"
            style={{left: circleOffset(), bottom: circleOffset()}}
          />
          <div
            ref={(el) => store.rightBottomEl = el}
            class="media-editor__resizable-container-circle"
            style={{right: circleOffset(), bottom: circleOffset()}}
          />
        </div>
      </Portal>
    </div>
  );
}


type UseResizeArgs = {
  container: HTMLDivElement;
  leftTopEl: () => HTMLDivElement;
  rightTopEl: () => HTMLDivElement;
  leftBottomEl: () => HTMLDivElement;
  rightBottomEl: () => HTMLDivElement;

  diff: NumberPair;
  layer: ResizableLayer;
  processedLayer: Accessor<ProcessedLayer>;
  normalizePoint: (point: NumberPair) => NumberPair;
  finalTransform: {
    flip: NumberPair;
    rotation: number;
    scale: number;
    translation: NumberPair;
  };
};

function useResizeHandles({
  container,
  leftTopEl,
  rightTopEl,
  leftBottomEl,
  rightBottomEl,
  diff,
  layer,
  processedLayer,
  normalizePoint,
  finalTransform
}: UseResizeArgs) {
  const {editorState, mediaState} = useMediaEditorContext();


  let firstTarget: EventTarget;
  let swipeStarted = false;

  const multipliers = [
    {el: leftTopEl, x: -1, y: -1, corner: 'leftTop'},
    {el: rightTopEl, x: 1, y: -1, corner: 'rightTop'},
    {el: leftBottomEl, x: -1, y: 1, corner: 'leftBottom'},
    {el: rightBottomEl, x: 1, y: 1, corner: 'rightBottom'}
  ];

  let initialWidth = 0;
  let initialHeight = 0;

  multipliers.forEach(({el, x, y, corner}) => {
    createEffect(() => {
      const element = el();
      if(!element) return;

      const swipeHandler = new SwipeHandler({
        element,
        onStart() {
          element.classList.add('media-editor__resizable-container-circle--anti-flicker');
          initialWidth = layer.width || container.clientWidth;
          initialHeight = layer.height || container.clientHeight;
        },
        onSwipe(xDiff, yDiff, _e) {
          const e = getEvent(_e);

          if(!firstTarget) firstTarget = e.target;
          if(firstTarget !== element) return;

          // Независимое изменение ширины и высоты
          const newWidth = initialWidth + (xDiff * x);
          const newHeight = initialHeight + (yDiff * y);

          modifyMutable(layer, produce(s => {
            s.width = Math.max(50, newWidth);  // Минимум 50px
            s.height = Math.max(30, newHeight); // Минимум 30px
          }));
        },
        onReset() {
          element.classList.remove('media-editor__resizable-container-circle--anti-flicker');
          firstTarget = undefined;
          
          // Синхронизируем размеры с OCR разметкой
          const fileForSync = getCurrentFile(editorState, mediaState);
          if (fileForSync && layer.ocrBlockIndex !== undefined && fileForSync.result?.result?.textAnnotation?.blocks) {
            const block = fileForSync.result.result.textAnnotation.blocks[layer.ocrBlockIndex];
            if (block) {
              const x = Math.round(layer.position[0]);
              const y = Math.round(layer.position[1]);
              const width = Math.round(layer.width || 0);
              const height = Math.round(layer.height || 0);
              
              block.boundingBox = {
                vertices: [
                  { x: String(x), y: String(y) },
                  { x: String(x + width), y: String(y) },
                  { x: String(x + width), y: String(y + height) },
                  { x: String(x), y: String(y + height) }
                ]
              };
            }
          }
        }
      });
      onCleanup(() => {
        swipeHandler.removeListeners();
      });
    });
  });


  const moveHandler = new SwipeHandler({
    element: container,
    onSwipe(xDiff, yDiff, e) {
      if(!firstTarget) firstTarget = e.target;
      if(multipliers.find(({el}) => el() === firstTarget)) return;

      if(!swipeStarted) {
        // onStart messes up the typing
        swipeStarted = true;
        const file = getCurrentFile(editorState, mediaState);
        if (file) {
          file.selectedResizableLayer = layer.id;
        }
      }

      diff.splice(0, 2, xDiff, yDiff);
    },
    onReset() {
      const screenPosition = [processedLayer().position[0] + diff[0], processedLayer().position[1] + diff[1]] as NumberPair;
      const newPosition = normalizePoint(screenPosition);
      
      // Вычисляем uniformScale для преобразования в reference координаты
      const file = getCurrentFile(editorState, mediaState);
      if (!file || !file.canvasSize) {
        diff.splice(0, 2, 0, 0);
        swipeStarted = false;
        firstTarget = undefined;
        return;
      }
      
      const [canvasWidth, canvasHeight] = file.canvasSize;
      
      // Use file's referenceSize (original dimensions) instead of hardcoded 800x600
      const referenceSize = file.referenceSize || file.imageDimensions || [800, 600];
      const [referenceWidth, referenceHeight] = referenceSize;
      
      const scaleX = canvasWidth / referenceWidth;
      const scaleY = canvasHeight / referenceHeight;
      const uniformScale = Math.min(scaleX, scaleY);
      
      // basePosition в reference координатах (800x600)
      const basePosition: NumberPair = [
        newPosition[0] / uniformScale,
        newPosition[1] / uniformScale
      ];
      
      modifyMutable(layer, produce(s => {
        s.position = newPosition;
        s.basePosition = basePosition;
      }));
      
      // Синхронизируем координаты с OCR разметкой
      if (layer.ocrBlockIndex !== undefined && file.result?.result?.textAnnotation?.blocks) {
        const block = file.result.result.textAnnotation.blocks[layer.ocrBlockIndex];
        if (block) {
          const x = Math.round(layer.position[0]);
          const y = Math.round(layer.position[1]);
          const width = Math.round(layer.width || 0);
          const height = Math.round(layer.height || 0);
          
          block.boundingBox = {
            vertices: [
              { x: String(x), y: String(y) },
              { x: String(x + width), y: String(y) },
              { x: String(x + width), y: String(y + height) },
              { x: String(x), y: String(y + height) }
            ]
          };
        }
      }
      
      diff.splice(0, 2, 0, 0);
      swipeStarted = false;
      firstTarget = undefined;
    }
  });

  onCleanup(() => {
    moveHandler.removeListeners();
  });
}


type UseContextMenuArgs = {
  container: HTMLDivElement;
  layer: ResizableLayer;
}

function useContextMenu({container, layer}: UseContextMenuArgs) {
  const {editorState, mediaState, actions} = useMediaEditorContext();

  function onClick() {
    // Get the correct layers array (file-specific only now)
    const targetFile = editorState.targetFile;
    if (!targetFile?.textLayers) return; // No layers to delete from
    const layers = targetFile.textLayers;
    const idx = layers.findIndex(otherLayer => otherLayer.id === layer.id);
    if(idx < 0) return;

    batch(() => {
      targetFile.selectedResizableLayer = undefined;
    });
  }

  const contextMenu = createContextMenu({
    buttons: [
      {
        icon: 'delete',
        className: 'danger',
        text: 'Delete',
        onClick
      }
    ],
    listenTo: container,
    onElementReady: (element) => {
      element.classList.add('night');
    }
  });

  onCleanup(() => {
    contextMenu.destroy();
  });
}
