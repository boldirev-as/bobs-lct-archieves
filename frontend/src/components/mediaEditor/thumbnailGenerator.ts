import { UploadedFile } from './types';

export interface ParagraphThumbnail {
  blockIndex: number;
  fileId: string; // Add file ID to prevent cross-file conflicts
  thumbnail: string;
  coordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  lastUpdated: number;
}

// Новый тип для хранения thumbnails в сторе
export type ThumbnailsStore = Record<string, Record<string, string>>;

export async function generateParagraphThumbnail(
  file: UploadedFile,
  blockIndex: number,
  imageElement: HTMLImageElement,
  containerSize: [number, number]
): Promise<ParagraphThumbnail | null> {
  console.log('generateParagraphThumbnail called:', {
    fileId: file.id,
    blockIndex,
    hasTextLayers: !!file.textLayers,
    textLayersCount: file.textLayers?.length || 0,
    hasOcrBlocks: !!file.result?.result?.textAnnotation?.blocks,
    ocrBlocksCount: file.result?.result?.textAnnotation?.blocks?.length || 0
  });
  
  // Проверяем наличие textLayers или OCR blocks
  if (!file.textLayers && !file.result?.result?.textAnnotation?.blocks) {
    console.log('No textLayers or OCR blocks found in file');
    return null;
  }

  let layer = null;
  
  // Сначала пытаемся найти в textLayers
  if (file.textLayers) {
    layer = file.textLayers.find(l => l.ocrBlockIndex === blockIndex);
    console.log('Found layer in textLayers for block:', blockIndex, 'layer:', !!layer);
  }
  
  // Если не найден в textLayers, создаем временный слой из OCR данных
  if (!layer && file.result?.result?.textAnnotation?.blocks) {
    const ocrBlock = file.result.result.textAnnotation.blocks[blockIndex];
    if (ocrBlock) {
      // Создаем временный слой из OCR данных
      const vertices = ocrBlock.boundingBox.vertices;
      const x1 = parseInt(vertices[0].x) || 0;
      const y1 = parseInt(vertices[0].y) || 0;
      const x2 = parseInt(vertices[2].x) || 0;
      const y2 = parseInt(vertices[2].y) || 0;
      
      const left = Math.min(x1, x2);
      const top = Math.min(y1, y2);
      const width = Math.abs(x2 - x1);
      const height = Math.abs(y2 - y1);
      
      layer = {
        id: Date.now() + Math.random(),
        position: [left, top],
        width: width,
        height: height,
        scale: 1,
        rotation: 0,
        ocrBlockIndex: blockIndex
      };
      console.log('Created temporary layer from OCR for block:', blockIndex);
    }
  }
  
  if (!layer) {
    console.log('No layer found for block:', blockIndex);
    return null;
  }

  // ПОЛУЧАЕМ АКТУАЛЬНЫЕ РАЗМЕРЫ ИЗОБРАЖЕНИЯ ИЗ <img> ЭЛЕМЕНТА
  const imageRect = imageElement.getBoundingClientRect();
  const imageDisplayWidth = imageRect.width;
  const imageDisplayHeight = imageRect.height;
  
  // Получаем размеры оригинального изображения
  const imageNaturalWidth = imageElement.naturalWidth;
  const imageNaturalHeight = imageElement.naturalHeight;
  
  // Вычисляем масштаб от отображаемого размера к оригинальному
  const scaleX = imageNaturalWidth / imageDisplayWidth;
  const scaleY = imageNaturalHeight / imageDisplayHeight;

  // КОПИРУЕМ ТОЧНО ТАКУЮ ЖЕ ЛОГИКУ, КАК В media-editor__resizable-container
  const processedLayer = {
    position: layer.position,
    rotation: layer.rotation,
    scale: layer.scale
  };

  // store.diff - это временное смещение при перетаскивании, для миниатюр не нужно
  const storeDiff = [0, 0];

  // ТОЧНО ТАКИЕ ЖЕ КООРДИНАТЫ, КАК В CSS СТИЛЯХ КОНТЕЙНЕРА
  const left = processedLayer.position[0] + storeDiff[0];
  const top = processedLayer.position[1] + storeDiff[1];
  const width = layer.width ? layer.width * processedLayer.scale : 0;
  const height = layer.height ? layer.height * processedLayer.scale : 0;

  // ПЕРЕВОДИМ КООРДИНАТЫ СЛОЯ В КООРДИНАТЫ ОРИГИНАЛЬНОГО ИЗОБРАЖЕНИЯ
  const imageLeft = left * scaleX;
  const imageTop = top * scaleY;
  const imageWidth = width * scaleX;
  const imageHeight = height * scaleY;

  // Создаем canvas для миниатюры
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    return null;
  }

  // Размеры миниатюры - используем точные размеры слоя
  const thumbnailWidth = Math.max(1, Math.round(imageWidth));
  const thumbnailHeight = Math.max(1, Math.round(imageHeight));

  canvas.width = thumbnailWidth;
  canvas.height = thumbnailHeight;

  // Заливаем фон
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, thumbnailWidth, thumbnailHeight);
  
  // Вырезаем нужную область из изображения напрямую
  ctx.drawImage(
    imageElement,
    imageLeft, imageTop, imageWidth, imageHeight, // source coordinates - область для вырезания
    0, 0, thumbnailWidth, thumbnailHeight // destination coordinates - заполняем весь canvas
  );

  const thumbnail: ParagraphThumbnail = {
    blockIndex,
    fileId: file.id, // Include file ID to prevent cross-file conflicts
    thumbnail: canvas.toDataURL('image/jpeg'), // Улучшаем качество JPEG (0.95 вместо 1)
    coordinates: {
      x: left,
      y: top,
      width,
      height
    },
    lastUpdated: Date.now()
  };

  console.log('Generated thumbnail for block:', blockIndex, 'size:', canvas.width, 'x', canvas.height);
  return thumbnail;
}

export async function updateAllParagraphThumbnails(
  file: UploadedFile,
  imageElement: HTMLImageElement,
  containerSize: [number, number]
): Promise<ParagraphThumbnail[]> {
  // Проверяем наличие OCR данных или textLayers
  const hasOcrBlocks = file.result?.result?.textAnnotation?.blocks;
  const hasTextLayers = file.textLayers && file.textLayers.length > 0;
  
  console.log('updateAllParagraphThumbnails called:', {
    hasOcrBlocks: !!hasOcrBlocks,
    hasTextLayers: !!hasTextLayers,
    textLayersCount: file.textLayers?.length || 0,
    ocrBlocksCount: hasOcrBlocks?.length || 0
  });

  if (!hasOcrBlocks && !hasTextLayers) {
    console.log('No OCR blocks or textLayers available');
    return [];
  }

  const thumbnails: ParagraphThumbnail[] = [];
  
  // Используем textLayers если доступны, иначе OCR blocks
  const blockCount = hasTextLayers ? file.textLayers!.length : hasOcrBlocks!.length;
  console.log('Generating thumbnails for', blockCount, 'blocks');

  for (let i = 0; i < blockCount; i++) {
    try {
      const thumbnail = await generateParagraphThumbnail(file, i, imageElement, containerSize);
      if (thumbnail) {
        thumbnails.push(thumbnail);
      }
    } catch (error) {
      console.warn(`Failed to generate thumbnail for block ${i}:`, error);
    }
  }

  return thumbnails;
}

// Новые функции для работы с глобальным хранилищем thumbnails

/**
 * Сохраняет thumbnail в глобальное хранилище
 */
export function cacheThumbnailInStore(
  thumbnailsStore: ThumbnailsStore, 
  fileId: string, 
  paragraphId: string, 
  thumbnail: string
) {
  if (!thumbnailsStore[fileId]) {
    thumbnailsStore[fileId] = {};
  }
  thumbnailsStore[fileId][paragraphId] = thumbnail;
}

/**
 * Получает thumbnail из глобального хранилища
 */
export function getCachedThumbnailFromStore(
  thumbnailsStore: ThumbnailsStore, 
  fileId: string, 
  paragraphId: string
): string | null {
  if (!fileId) {
    console.log('getCachedThumbnailFromStore: fileId is undefined or empty');
    return null;
  }

  console.log('getCachedThumbnailFromStore:', { fileId, paragraphId, fileExists: !!thumbnailsStore[fileId] });
  if (thumbnailsStore[fileId]) {
    console.log('File thumbnails keys:', Object.keys(thumbnailsStore[fileId]));
    console.log('Looking for paragraph:', paragraphId);
    console.log('Paragraph value:', thumbnailsStore[fileId][paragraphId]);
  }
  const result = thumbnailsStore[fileId]?.[paragraphId] || null;
  console.log('getCachedThumbnailFromStore result:', !!result);
  return result;
}

/**
 * Сохраняет массив thumbnails в глобальное хранилище
 */
export function cacheThumbnailsInStore(
  thumbnailsStore: ThumbnailsStore, 
  fileId: string, 
  thumbnails: ParagraphThumbnail[]
) {
  if (!thumbnailsStore[fileId]) {
    thumbnailsStore[fileId] = {};
  }
  
  thumbnails.forEach(thumbnail => {
    const paragraphId = `paragraph_${thumbnail.blockIndex}`;
    thumbnailsStore[fileId][paragraphId] = thumbnail.thumbnail;
  });
}

/**
 * Получает thumbnail из глобального хранилища по blockIndex
 */
export function getCachedThumbnailByBlockIndex(
  thumbnailsStore: ThumbnailsStore, 
  fileId: string, 
  blockIndex: number
): string | null {
  if (!fileId) {
    console.log('getCachedThumbnailByBlockIndex: fileId is undefined or empty');
    return null;
  }

  const paragraphId = `paragraph_${blockIndex}`;
  console.log('getCachedThumbnailByBlockIndex:', { fileId, blockIndex, paragraphId, store: thumbnailsStore });
  console.log('File thumbnails in store:', thumbnailsStore[fileId]);
  console.log('Store keys:', Object.keys(thumbnailsStore));
  console.log('File exists in store:', !!thumbnailsStore[fileId]);
  if (thumbnailsStore[fileId]) {
    console.log('File thumbnails keys:', Object.keys(thumbnailsStore[fileId]));
    console.log('Looking for paragraph:', paragraphId);
    console.log('Paragraph exists:', !!thumbnailsStore[fileId][paragraphId]);
  }
  const result = getCachedThumbnailFromStore(thumbnailsStore, fileId, paragraphId);
  console.log('getCachedThumbnailByBlockIndex result:', result);
  return result;
}

/**
 * Очищает все thumbnails для конкретного файла
 */
export function clearThumbnailsForFile(thumbnailsStore: ThumbnailsStore, fileId: string) {
  if (thumbnailsStore[fileId]) {
    delete thumbnailsStore[fileId];
  }
}
