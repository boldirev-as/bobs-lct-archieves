import { createEffect, createSignal, onCleanup, createMemo } from 'solid-js';
import { useMediaEditorContext } from './context';
import { modifyMutable } from 'solid-js/store';
import { 
  generateParagraphThumbnail, 
  updateAllParagraphThumbnails, 
  cacheThumbnailsInStore,
  getCachedThumbnailByBlockIndex,
  cacheThumbnailInStore,
  clearThumbnailsForFile,
  ParagraphThumbnail 
} from './thumbnailGenerator';

/**
 * Хук для отслеживания изменений координат абзацев и генерации миниатюр
 */
export function useParagraphThumbnails() {
  const { editorState, mediaState, actions } = useMediaEditorContext();
  
  const [isGenerating, setIsGenerating] = createSignal(false);
  const [lastUpdateTime, setLastUpdateTime] = createSignal(0);
  
  let updateTimeout: ReturnType<typeof setTimeout> | null = null;
  let imageElement: HTMLImageElement | null = null;
  let containerSize: [number, number] = [0, 0];
  let lastTrackedFileId: string | null = null;
  let lastTrackedThumbnailCount: number = 0;
  let lastExecutionTime: number = 0;
  const MIN_EXECUTION_INTERVAL = 2000; // Минимум 2 секунды между выполнениями

  /**
   * Устанавливает ссылку на элемент изображения
   */
  const setImageElement = (img: HTMLImageElement | null, size: [number, number]) => {
    console.log('Setting image element for file:', editorState.targetFile?.id, 'image:', img ? 'YES' : 'NO', 'size:', size);
    imageElement = img;
    containerSize = size;
  };

  /**
   * Генерирует миниатюры для всех абзацев текущего файла
   */
  const generateThumbnails = async () => {
    const currentFile = editorState.targetFile;
    console.log('generateThumbnails called:', {
      currentFile: !!currentFile,
      imageElement: !!imageElement,
      containerSize,
      fileId: currentFile?.id,
      hasResult: !!currentFile?.result,
      hasNestedResult: !!currentFile?.result?.result,
      hasTextAnnotation: !!currentFile?.result?.result?.textAnnotation,
      hasBlocks: !!currentFile?.result?.result?.textAnnotation?.blocks,
      blocksCount: currentFile?.result?.result?.textAnnotation?.blocks?.length || 0
    });
    
    // Дополнительная диагностика структуры файла
    console.log('File structure debug:', {
      file: currentFile,
      result: currentFile?.result,
      nestedResult: currentFile?.result?.result,
      textAnnotation: currentFile?.result?.result?.textAnnotation,
      blocks: currentFile?.result?.result?.textAnnotation?.blocks
    });
    
    if (!currentFile || !imageElement) {
      console.log('Cannot generate thumbnails: missing file or image element');
      return;
    }

    if (!currentFile.id) {
      console.log('Cannot generate thumbnails: file has no ID');
      return;
    }

    // Проверяем наличие OCR данных или textLayers
    const hasOcrBlocks = currentFile.result?.result?.textAnnotation?.blocks;
    const hasTextLayers = currentFile.textLayers && currentFile.textLayers.length > 0;
    
    if (!hasOcrBlocks && !hasTextLayers) {
      console.log('Cannot generate thumbnails: No OCR data or textLayers available');
      console.log('File structure:', {
        hasResult: !!currentFile.result,
        hasNestedResult: !!currentFile.result?.result,
        hasTextAnnotation: !!currentFile.result?.result?.textAnnotation,
        hasBlocks: !!currentFile.result?.result?.textAnnotation?.blocks,
        hasTextLayers: !!currentFile.textLayers,
        textLayersCount: currentFile.textLayers?.length || 0
      });
      return;
    }
    
    if (hasTextLayers) {
      console.log('Using textLayers for thumbnail generation, count:', currentFile.textLayers.length);
    } else if (hasOcrBlocks) {
      console.log('Using OCR blocks for thumbnail generation, count:', hasOcrBlocks.length);
    }

    // Защита от бесконечных вызовов
    if (isGenerating()) {
      console.log('Already generating thumbnails, skipping');
      return;
    }

    // Проверяем, прошло ли достаточно времени с последнего выполнения
    const now = Date.now();
    if (now - lastExecutionTime < MIN_EXECUTION_INTERVAL) {
      console.log('Thumbnail generation throttled, skipping');
      return;
    }

    console.log('Generating thumbnails for file:', currentFile.id, currentFile.filename);
    setIsGenerating(true);
    lastExecutionTime = now;
    
    try {
      const thumbnails = await updateAllParagraphThumbnails(currentFile, imageElement, containerSize);
      // Используем modifyMutable для правильной мутации стора
      modifyMutable(mediaState, (state) => {
        if (!state.paragraphThumbnails[currentFile.id]) {
          state.paragraphThumbnails[currentFile.id] = {};
        }
        
        thumbnails.forEach(thumbnail => {
          const paragraphId = `paragraph_${thumbnail.blockIndex}`;
          state.paragraphThumbnails[currentFile.id][paragraphId] = thumbnail.thumbnail;
          console.log('Storing thumbnail for:', paragraphId, 'in file:', currentFile.id);
        });
        return state;
      });
      
      // Verify the store was updated correctly
      const updatedThumbnails = mediaState.paragraphThumbnails[currentFile.id];
      console.log('Generated thumbnails for file:', currentFile.id, 'count:', thumbnails.length);
      console.log('Updated store:', mediaState.paragraphThumbnails);
      console.log('File thumbnails after update:', updatedThumbnails);
      console.log('File thumbnails keys after update:', Object.keys(updatedThumbnails || {}));
      
      // Test retrieval immediately after storage
      if (thumbnails.length > 0) {
        const testBlockIndex = thumbnails[0].blockIndex;
        const testCached = getCachedThumbnailByBlockIndex(mediaState.paragraphThumbnails, currentFile.id, testBlockIndex);
        console.log('Immediate cache test for block', testBlockIndex, ':', !!testCached);
      }
      setLastUpdateTime(Date.now());
    } catch (error) {
      console.error('Failed to generate paragraph thumbnails:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Генерирует миниатюру для конкретного абзаца
   */
  const generateThumbnailForBlock = async (blockIndex: number) => {
    const currentFile = editorState.targetFile;
    const img = imageElement;
    const size = containerSize;
    
    console.log('generateThumbnailForBlock called:', {
      blockIndex,
      currentFile: !!currentFile,
      imageElement: !!img,
      containerSize: size,
      fileId: currentFile?.id
    });
    
    if (!currentFile || !img) {
      console.log('Cannot generate thumbnail for block: missing requirements');
      return null;
    }

    if (!currentFile.id) {
      console.log('Cannot generate thumbnail for block: file has no ID');
      return null;
    }

    try {
      const thumbnail = await generateParagraphThumbnail(currentFile, blockIndex, img, size);
      if (thumbnail) {
        const paragraphId = `paragraph_${blockIndex}`;
        
        // Используем modifyMutable для правильной мутации стора
        modifyMutable(mediaState, (state) => {
          if (!state.paragraphThumbnails[currentFile.id]) {
            state.paragraphThumbnails[currentFile.id] = {};
          }
          state.paragraphThumbnails[currentFile.id][paragraphId] = thumbnail.thumbnail;
          console.log('Stored individual thumbnail for:', paragraphId, 'in file:', currentFile.id);
          return state;
        });
        
        // Verify the individual thumbnail was stored
        const storedThumbnail = mediaState.paragraphThumbnails[currentFile.id]?.[paragraphId];
        console.log('Verification - stored thumbnail for', paragraphId, ':', !!storedThumbnail);
        
        setLastUpdateTime(Date.now());
      }
      return thumbnail;
    } catch (error) {
      console.error(`Failed to generate thumbnail for block ${blockIndex}:`, error);
      return null;
    }
  };

  /**
   * Получает миниатюру для абзаца (из кэша или генерирует новую)
   */
  const getThumbnail = async (blockIndex: number): Promise<string | null> => {
    const currentFile = editorState.targetFile;
    if (!currentFile) {
      console.log('No current file for thumbnail request');
      return null;
    }

    if (!currentFile.id) {
      console.log('Current file has no ID:', currentFile);
      return null;
    }

    console.log('Getting thumbnail for block:', blockIndex, 'in file:', currentFile.id);
    console.log('Current thumbnails store:', mediaState.paragraphThumbnails);
    console.log('File thumbnails:', mediaState.paragraphThumbnails[currentFile.id]);

    // Сначала проверяем кэш в глобальном хранилище
    const cached = getCachedThumbnailByBlockIndex(mediaState.paragraphThumbnails, currentFile.id, blockIndex);
    if (cached) {
      console.log('Found cached thumbnail for block:', blockIndex, 'in file:', currentFile.id);
      return cached;
    }

    console.log('No cached thumbnail, generating new one for block:', blockIndex, 'in file:', currentFile.id);
    
    // If we don't have the image element ready, we can't generate thumbnails
    if (!imageElement) {
      console.log('Cannot generate thumbnail: imageElement not ready');
      return null;
    }
    
    // Если нет в кэше, генерируем новую
    const thumbnail = await generateThumbnailForBlock(blockIndex);
    return thumbnail?.thumbnail || null;
  };

  const trackParagraphChanges = () => {
    const currentFile = editorState.targetFile;
    console.log('trackParagraphChanges called:', {
      currentFile: !!currentFile,
      hasTextLayers: !!currentFile?.textLayers,
      textLayersCount: currentFile?.textLayers?.length || 0,
      fileId: currentFile?.id
    });
    
    if (!currentFile?.textLayers) {
      console.log('No textLayers found, skipping paragraph changes tracking');
      return;
    }

    if (!currentFile.id) {
      console.log('Current file has no ID, skipping paragraph changes tracking');
      return;
    }

    if (lastTrackedFileId !== currentFile.id) {
      lastTrackedFileId = currentFile.id;
      lastTrackedThumbnailCount = Object.keys(mediaState.paragraphThumbnails[currentFile.id] || {}).length;
    }

    const textLayers = currentFile.textLayers;
    const currentThumbnailCount = Object.keys(mediaState.paragraphThumbnails[currentFile.id] || {}).length;
    
    // Если количество миниатюр изменилось, нужно обновить
    if (currentThumbnailCount !== lastTrackedThumbnailCount) {
      lastTrackedThumbnailCount = currentThumbnailCount;
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }
      
      updateTimeout = setTimeout(() => {
        generateThumbnails();
      }, 500);
      return;
    }
    
    // Проверяем, изменились ли координаты у любого слоя
    let hasChanges = false;
    
    textLayers.forEach((layer) => {
      if (layer.ocrBlockIndex === undefined) return;
      
      const cached = getCachedThumbnailByBlockIndex(mediaState.paragraphThumbnails, currentFile.id, layer.ocrBlockIndex);
      if (!cached) {
        hasChanges = true;
        console.log('Missing thumbnail for block:', layer.ocrBlockIndex, 'in file:', currentFile.id);
        return;
      }
      
      // Если thumbnail есть, считаем что изменения не нужны
      // В будущем можно добавить проверку координат для более точного отслеживания
    });

    if (hasChanges) {
      console.log('Changes detected, scheduling thumbnail generation');
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }
      
      updateTimeout = setTimeout(() => {
        generateThumbnails();
      }, 1000); // Увеличиваем задержку до 1 секунды
    }
  };

  // Отслеживаем изменения в координатах абзацев с дебаунсингом
  createEffect(() => {
    const currentFile = editorState.targetFile;
    if (!currentFile?.textLayers) {
      return;
    }

    // Используем дебаунсинг для предотвращения частых вызовов
    const timeoutId = setTimeout(() => {
      trackParagraphChanges();
    }, 100);

    return () => clearTimeout(timeoutId);
  });

  // Отслеживаем изменения в файле и генерируем миниатюры
  createEffect(() => {
    const currentFile = editorState.targetFile;
    if (!currentFile) {
      return;
    }

    console.log('File effect triggered for file:', currentFile.id);

    // НЕ очищаем imageElement - он должен сохраняться между файлами
    // imageElement = null;
    // containerSize = [0, 0];
    
    // Only clear thumbnails if this is a different file than last tracked
    if (lastTrackedFileId !== currentFile.id) {
      console.log('File changed from', lastTrackedFileId, 'to', currentFile.id);
      // Don't clear thumbnails immediately - let the generation process handle it
      // This prevents race conditions where thumbnails are cleared after being generated
    }
    
    console.log('File changed, current file:', currentFile.id);
  });

  // Генерируем миниатюры когда есть и файл, и элемент изображения
  createEffect(() => {
    const currentFile = editorState.targetFile;
    const img = imageElement;
    const size = containerSize;
    
    console.log('Thumbnail generation effect triggered:', {
      currentFile: !!currentFile,
      imageElement: !!img,
      containerSize: size,
      fileId: currentFile?.id,
      hasOcrData: !!currentFile?.result?.result?.textAnnotation?.blocks
    });
    
    if (currentFile && img && size[0] > 0 && size[1] > 0) {
      console.log('Ready to generate thumbnails for file:', currentFile.id, 'imageElement:', !!img);
      
      // Check if OCR data or textLayers are available
      const hasOcrBlocks = currentFile.result?.result?.textAnnotation?.blocks;
      const hasTextLayers = currentFile.textLayers && currentFile.textLayers.length > 0;
      
      if (!hasOcrBlocks && !hasTextLayers) {
        console.log('OCR data and textLayers not available yet, will retry later');
        // Retry after a delay to wait for data
        const timeoutId = setTimeout(() => {
          // Re-trigger the effect by checking again
          const hasOcrBlocksRetry = currentFile.result?.result?.textAnnotation?.blocks;
          const hasTextLayersRetry = currentFile.textLayers && currentFile.textLayers.length > 0;
          if (hasOcrBlocksRetry || hasTextLayersRetry) {
            console.log('Data now available, retrying thumbnail generation');
            generateThumbnails();
          }
        }, 1000);
        
        return () => clearTimeout(timeoutId);
      }
      
      // Проверяем, есть ли уже миниатюры для этого файла
      const existingThumbnails = Object.keys(mediaState.paragraphThumbnails[currentFile.id] || {});
      console.log('Existing thumbnails for file:', currentFile.id, 'count:', existingThumbnails.length, 'keys:', existingThumbnails);
      
      // Also check if we have the expected number of thumbnails based on text layers
      const expectedThumbnailCount = currentFile.textLayers?.length || 0;
      const hasCorrectCount = existingThumbnails.length === expectedThumbnailCount;
      
      if (existingThumbnails.length === 0 || !hasCorrectCount) {
        console.log('No thumbnails found or incorrect count, generating new ones for file:', currentFile.id);
        console.log('Expected count:', expectedThumbnailCount, 'Actual count:', existingThumbnails.length);
        // Используем дебаунсинг для предотвращения частых вызовов
        const timeoutId = setTimeout(() => {
          generateThumbnails();
        }, 200);
        
        return () => clearTimeout(timeoutId);
      } else {
        console.log('Thumbnails already exist for file:', currentFile.id, 'count:', existingThumbnails.length);
      }
    } else {
      console.log('Cannot generate thumbnails - missing requirements:', {
        currentFile: !!currentFile,
        imageElement: !!img,
        containerSize: size
      });
    }
  });

  onCleanup(() => {
    if (updateTimeout) {
      clearTimeout(updateTimeout);
    }
  });

  return {
    isGenerating,
    lastUpdateTime,
    setImageElement,
    generateThumbnails,
    generateThumbnailForBlock,
    getThumbnail,
    getCachedThumbnail: (blockIndex: number) => {
      const currentFile = editorState.targetFile;
      if (!currentFile) return null;
      
      if (!currentFile.id) {
        console.log('Current file has no ID:', currentFile);
        return null;
      }
      
      console.log('getCachedThumbnail called for block:', blockIndex, 'file:', currentFile.id);
      console.log('Store state:', mediaState.paragraphThumbnails);
      console.log('File thumbnails:', mediaState.paragraphThumbnails[currentFile.id]);
      
      const thumbnail = getCachedThumbnailByBlockIndex(mediaState.paragraphThumbnails, currentFile.id, blockIndex);
      console.log('getCachedThumbnail result:', !!thumbnail);
      return thumbnail ? { thumbnail } : null;
    }
  };
}
