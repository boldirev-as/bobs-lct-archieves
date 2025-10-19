import {onCleanup, onMount, Show, createMemo, createSignal, createEffect} from 'solid-js';

import {useMediaEditorContext} from '../context';
import {NumberPair, ResizableLayer} from '../types';
import {getCurrentFile} from '../utils';
import {observeResize} from '../../resizeObserver';
import {useFileByIndex, useFileById, useIsFileActive} from '../hooks/useFileByIndex';
import {batch} from 'solid-js';
import { useParagraphThumbnails } from '../useParagraphThumbnails';

import CropHandles from './cropHandles';
import ImageCanvas from './imageCanvas';
import ResizableLayers from './resizableLayers';
import RotationWheel from './rotationWheel';

interface MainCanvasProps {
  fileId?: string;
  fileIndex?: number;
  isInView?: boolean;
}

export default function MainCanvas(props: MainCanvasProps) {
  let container: HTMLDivElement;
  const context = useMediaEditorContext();
  const {editorState, mediaState} = context;
  
  const [imageElement, setImageElement] = createSignal<HTMLImageElement | null>(null);
  const [overlayStyle, setOverlayStyle] = createSignal('position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;');
  const [handlesStyle, setHandlesStyle] = createSignal('position: absolute; top: 0; left: 0; width: 100%; height: 100%;');
  const paragraphThumbnails = useParagraphThumbnails();
  const [editingRect, setEditingRect] = createSignal<{x: number, y: number, width: number, height: number} | null>(null);
  
  createEffect(() => {
    const img = imageElement();
    console.log('MainCanvas effect - imageElement:', !!img, 'container:', !!container);
    if (img && container) {
      const rect = container.getBoundingClientRect();
      console.log('Setting image element with size:', [rect.width, rect.height]);
      paragraphThumbnails.setImageElement(img, [rect.width, rect.height]);
    }
  });

  createEffect(() => {
    if (!editorState.isEditingParagraph) {
      setEditingRect(null);
      return;
    }
    
    let frameId: number;
    
    const update = () => {
      const file = currentFile();
      const layer = file?.textLayers?.find(l => l.ocrBlockIndex === editorState.editingBlockIndex);
      
      if (!layer || !file) {
        setEditingRect(null);
        return;
      }
      
      // Try to get actual position from DOM element
      const layerElement = container?.querySelector(`.media-editor__resizable-container[data-layer-id="${layer.id}"]`) as HTMLElement;
      
      if (layerElement) {
        // Use actual DOM position (includes temporary drag offset) but size from layer data
        const containerRect = container.getBoundingClientRect();
        const elementRect = layerElement.getBoundingClientRect();
        
        setEditingRect({
          x: elementRect.left - containerRect.left,
          y: elementRect.top - containerRect.top,
          width: layer.width * layer.scale,
          height: layer.height * layer.scale
        });
      } else {
        // Fallback to calculated position
        const canvasSize = file.canvasSize || [800, 600];
        const imageDims = file.imageDimensions || [800, 600];
        const imageAspectRatio = imageDims[0] / imageDims[1];
        const canvasAspectRatio = canvasSize[0] / canvasSize[1];
        
        let offsetX = 0;
        let offsetY = 0;
        
        if (imageAspectRatio > canvasAspectRatio) {
          const displayedHeight = canvasSize[0] / imageAspectRatio;
          offsetY = (canvasSize[1] - displayedHeight) / 2;
        } else {
          const displayedWidth = canvasSize[1] * imageAspectRatio;
          offsetX = (canvasSize[0] - displayedWidth) / 2;
        }
        
        setEditingRect({
          x: layer.position[0] + offsetX,
          y: layer.position[1] + offsetY,
          width: layer.width * layer.scale,
          height: layer.height * layer.scale
        });
      }
      
      if (editorState.isEditingParagraph) {
        frameId = requestAnimationFrame(update);
      }
    };
    
    update();
    
    onCleanup(() => {
      if (frameId) cancelAnimationFrame(frameId);
    });
  });

  // Get the file for this canvas using hooks
  // Priority: 1. By index (from swiper), 2. By ID, 3. Current file from context
  const fileByIndex = props.fileIndex !== undefined ? useFileByIndex(props.fileIndex) : () => undefined;
  const fileById = props.fileId ? useFileById(props.fileId) : () => undefined;
  
  const currentFile = createMemo(() => {
    const byIndex = fileByIndex();
    if (byIndex) return byIndex;
    
    // Then try by ID
    const byId = fileById();
    if (byId) return byId;
    
    // Fallback to current file from context
    return getCurrentFile(editorState, mediaState);
  });

  // Initialize text layers from OCR once
  const initTextLayersFromOcr = (file: any) => {
    // Skip if already initialized
    if (file.textLayers && file.textLayers.length > 0) {
      return;
    }

    // Check if OCR results exist
    if (!file.result?.result?.textAnnotation?.blocks) {
      return;
    }

    const blocks = file.result.result.textAnnotation.blocks;
    const imageWidth = parseInt(file.result.result.textAnnotation.width);
    const imageHeight = parseInt(file.result.result.textAnnotation.height);

    if (!imageWidth || !imageHeight || !blocks.length) {
      return;
    }

    console.log(`Initializing ${blocks.length} text layers from OCR`);

    file.textLayers = [];

    batch(() => {
      blocks.forEach((block: any, blockIndex: number) => {
        if (!block.boundingBox?.vertices || block.boundingBox.vertices.length < 4) {
          return;
        }

        // Use original vertices for rendering on canvas (boundingBox.vertices)
        const vertices = block.boundingBox.vertices;
        const x1 = parseInt(vertices[0].x) || 0;
        const y1 = parseInt(vertices[0].y) || 0;
        const x2 = parseInt(vertices[2].x) || 0;
        const y2 = parseInt(vertices[2].y) || 0;

        const left = Math.min(x1, x2);
        const top = Math.min(y1, y2);
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);

        if (width < 5 || height < 5) return;

        const text = block.lines?.map((line: any) => {
          return line.words?.map((word: any) => word.text || '').join(' ') || '';
        }).join('\n') || '';

        const newLayer: ResizableLayer = {
          id: Date.now() + Math.random(),
          type: 'text',
          position: [left, top] as NumberPair,
          basePosition: [left, top] as NumberPair,
          rotation: 0,
          scale: 1,
          baseScale: 1,
          width: width,
          height: height,
          baseWidth: width,
          baseHeight: height,
          ocrBlockIndex: blockIndex, // Связываем с OCR блоком
          textInfo: {
            font: 'roboto',
            size: 24,
            color: '#ffffff',
            alignment: 'left',
            style: 'normal'
          },
          textRenderingInfo: {
            width: width,
            height: height,
            lines: text.split('\n').map(line => ({
              left: 0,
              right: width,
              content: line,
              height: height / Math.max(1, text.split('\n').length)
            }))
          }
        };

        file.textLayers.push(newLayer);
      });
    });

    console.log(`Created ${file.textLayers.length} text layers`);
  };

  // Check if this canvas is for the currently active file  
  // Initialize file transform when this file becomes active
  createEffect(() => {
    const file = currentFile();
    if (file) {
      // Initialize file transform if it doesn't exist
      if (!file.transform) {
        file.transform = {
          flip: [1, 1] as NumberPair,
          rotation: 0,
          scale: 1,
          translation: [0, 0] as NumberPair
        };
      }

      // Initialize text layers from OCR if available
      initTextLayersFromOcr(file);
      
      // Update text layer scales when switching files
      updateTextLayerScales();
      // Update overlay position when switching files
      updateOverlayPosition();
    }
  });
  
  // Watch for changes in imageElement and update overlay position
  createEffect(() => {
    const img = imageElement();
    if (img) {
      // Обновляем позицию при загрузке изображения
      updateOverlayPosition();
      
      // Добавляем слушатель на load события изображения
      const handleImageLoad = () => updateOverlayPosition();
      img.addEventListener('load', handleImageLoad);
      
      onCleanup(() => {
        img.removeEventListener('load', handleImageLoad);
      });
    }
  });

  // Функция для обновления позиции overlay поверх изображения
  const updateOverlayPosition = () => {
    const img = imageElement();
    if (!img || !container) return;
    
    const imgRect = img.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    // Вычисляем позицию изображения относительно контейнера
    const left = imgRect.left - containerRect.left;
    const top = imgRect.top - containerRect.top;
    const width = imgRect.width;
    const height = imgRect.height;
    
    console.log('updateOverlayPosition:', {
      imgRect: { left: imgRect.left, top: imgRect.top, width: imgRect.width, height: imgRect.height },
      containerRect: { left: containerRect.left, top: containerRect.top },
      overlay: { left, top, width, height }
    });
    
    setOverlayStyle(`position: absolute; left: ${left}px; top: ${top}px; width: ${width}px; height: ${height}px; pointer-events: none;`);
    setHandlesStyle(`position: absolute; left: ${left}px; top: ${top}px; width: ${width}px; height: ${height}px;`);
  };

  // Function to update text layer scales and positions based on current canvas size
  const updateTextLayerScales = () => {
    const file = currentFile();
    if (!file || !file.imageDimensions || !file.canvasSize) return;
    
    const [imageWidth, imageHeight] = file.imageDimensions;
    const [canvasWidth, canvasHeight] = file.canvasSize;
    
    // Calculate how the image actually fits in the canvas (object-fit: contain)
    const imageAspectRatio = imageWidth / imageHeight;
    const canvasAspectRatio = canvasWidth / canvasHeight;
    
    let displayedImageWidth: number;
    let displayedImageHeight: number;
    
    if (imageAspectRatio > canvasAspectRatio) {
      // Image is wider - constrained by canvas width
      displayedImageWidth = canvasWidth;
      displayedImageHeight = canvasWidth / imageAspectRatio;
    } else {
      // Image is taller - constrained by canvas height
      displayedImageHeight = canvasHeight;
      displayedImageWidth = canvasHeight * imageAspectRatio;
    }
    
    // Use referenceSize (original image dimensions) instead of hardcoded 800x600
    const referenceSize = file.referenceSize || file.imageDimensions;
    const [referenceWidth, referenceHeight] = referenceSize;
    
    // Простое масштабирование: если изображение уменьшилось в 2 раза, то и все координаты уменьшаются в 2 раза
    const scaleX = displayedImageWidth / referenceWidth;
    const scaleY = displayedImageHeight / referenceHeight;
    const uniformScale = Math.min(scaleX, scaleY);
    
    console.log('updateTextLayerScales:', {
      imageDimensions: [imageWidth, imageHeight],
      canvasSize: [canvasWidth, canvasHeight],
      displayedSize: [displayedImageWidth, displayedImageHeight],
      referenceSize: referenceSize,
      uniformScale: uniformScale
    });
    
    if (file.textLayers) {
      file.textLayers.forEach(layer => {
        if (layer.type === 'text') {
          if (!layer.baseScale) {
            layer.baseScale = layer.scale;
          }
          if (!layer.basePosition) {
            layer.basePosition = [...layer.position] as NumberPair;
          }
          
          if (layer.baseScale) {
            layer.scale = layer.baseScale * uniformScale;
          }
          
          if (layer.basePosition) {
            layer.position = [
              layer.basePosition[0] * uniformScale,
              layer.basePosition[1] * uniformScale
            ] as NumberPair;
          }
        }
      });
    }
  };

  onMount(() => {
    const listener = () => {
      const bcr = container.getBoundingClientRect();
      const newSize: [number, number] = [bcr.width, bcr.height];
      
      // Always update global canvas size for active canvas
      if (bcr.width > 0 && bcr.height > 0) {
        const file = currentFile();
        
        // Only update if size actually changed
        const currentSize = file?.canvasSize;
        if (!currentSize || currentSize[0] !== newSize[0] || currentSize[1] !== newSize[1]) {
          console.log(`Updating canvas size for file ${file?.id}:`, newSize);
          
          // Save to current file only
          if (file) {
            file.canvasSize = [...newSize];
            // Update text layer scales when canvas size changes
            updateTextLayerScales();
            // Update overlay position when canvas size changes
            updateOverlayPosition();
          }
        }
      }
    };
    
    // Use ResizeObserver for more accurate resize detection
    const unobserve = observeResize(container, listener);
    
    // Initial call
    listener();
    
    const resizeHandler = () => {
      listener();
      updateOverlayPosition(); // Обновляем позицию overlay при resize окна
    };
    window.addEventListener('resize', resizeHandler);
    
    const intervalId = setInterval(() => {
      if (props.isInView) {
        updateTextLayerScales();
        updateOverlayPosition();
      }
    }, 600);
    
    onCleanup(() => {
      unobserve();
      window.removeEventListener('resize', resizeHandler);
      clearInterval(intervalId);
    });
  });

  return (
    <div ref={container} class="media-editor__main-canvas" classList={{"media-editor__main-canvas--active": true}}>
      {/* Image and resizable layers in the same container */}
      <Show when={currentFile()}>
        <div class="image-container" style="position: relative; width: 100%; height: 100%;">
          <ImageCanvas 
            fileId={props.fileId} 
            onImageElementReady={(img, size) => {
              console.log('MainCanvas: Received image element from ImageCanvas:', !!img, 'size:', size);
              setImageElement(img);
              // Also set the size for thumbnails
              if (img && container) {
                const rect = container.getBoundingClientRect();
                paragraphThumbnails.setImageElement(img, [rect.width, rect.height]);
              }
            }}
          />
          
          {/* Dimming overlay with cutout for editing element */}
          <Show when={editingRect()}>
            {(rect) => (
              <svg 
                style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1;"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <mask id="editing-mask">
                    <rect width="100%" height="100%" fill="white" />
                    <rect 
                      x={rect().x} 
                      y={rect().y} 
                      width={rect().width} 
                      height={rect().height} 
                      fill="black" 
                    />
                  </mask>
                </defs>
                <rect 
                  width="100%" 
                  height="100%" 
                  fill="rgba(0, 0, 0, 0.5)" 
                  mask="url(#editing-mask)" 
                />
              </svg>
            )}
          </Show>
          
          <Show when={props.isInView}>
            <div 
              class="resizable-layers-overlay" 
              classList={{"resizable-layers-overlay--interactive": true}}
              style={overlayStyle()}
            >
              <ResizableLayers 
                canvasSize={currentFile()?.canvasSize || [800, 600]}
                finalTransform={currentFile()?.transform || {flip: [1, 1], rotation: 0, scale: 1, translation: [0, 0]}}
                pixelRatio={editorState.pixelRatio}
                file={currentFile()}
                selectedLayerId={currentFile()?.selectedResizableLayer}
                resizeHandlesContainer={currentFile()?.resizeHandlesContainer}
              />
            </div>
          </Show>
        </div>
      </Show>
      
       <div 
         ref={(el) => {
           const file = currentFile();
           if (file) {
             file.resizeHandlesContainer = el;
           }
         }} 
         class="media-editor__resize-handles-overlay" 
         style={handlesStyle()}
       />
    </div>
  );
}
