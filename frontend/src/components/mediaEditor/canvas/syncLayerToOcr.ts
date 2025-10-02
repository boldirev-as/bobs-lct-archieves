import {ResizableLayer, UploadedFile} from '../types';

/**
 * Синхронизирует координаты и размеры ResizableLayer обратно в OCR boundingBox
 */
export function syncLayerToOcr(layer: ResizableLayer, file: UploadedFile) {
  // Проверяем, есть ли связь с OCR блоком
  if (layer.ocrBlockIndex === undefined || !file.result?.result?.textAnnotation?.blocks) {
    return;
  }

  const blocks = file.result.result.textAnnotation.blocks;
  const blockIndex = layer.ocrBlockIndex;

  if (blockIndex < 0 || blockIndex >= blocks.length) {
    console.warn(`OCR block with index ${blockIndex} not found.`);
    return;
  }

  const block = blocks[blockIndex];
  if (!block) return;

  // Получаем текущие координаты и размеры
  const x = Math.round(layer.position[0]);
  const y = Math.round(layer.position[1]);
  const width = Math.round(layer.width || 0);
  const height = Math.round(layer.height || 0);

  // Обновляем boundingBox блока
  block.boundingBox = {
    vertices: [
      { x: String(x), y: String(y) }, // Top-left
      { x: String(x + width), y: String(y) }, // Top-right
      { x: String(x + width), y: String(y + height) }, // Bottom-right
      { x: String(x), y: String(y + height) }, // Bottom-left
    ]
  };

  console.log(`Synced layer ${layer.id} to OCR block ${blockIndex}:`, {
    x, y, width, height
  });
}

