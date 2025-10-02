import {Signal} from 'solid-js';

import {Document} from '../../layer';

export type NumberPair = [number, number];

export type FinalTransform = {
  flip: NumberPair;
  rotation: number;
  scale: number;
  translation: NumberPair;
};

export type FileUploadStatus = 'pending' | 'in-queue' | 'processing' | 'done' | 'error';

export type GalleryItem = {
  id: string;
  src: string;
  blob?: Blob;
  size: NumberPair;
  type: 'image' | 'video';
  name: string;
  uploadedFile?: UploadedFile;
};

/**
 * Represents an uploaded file with all its associated data and metadata.
 * This type contains information about the file itself, its processing status,
 * UI state, content analysis results (OCR), and synchronization data with the server.
 *
 * The structure is organized into several sections:
 * - Basic file information (id, status, filename, etc.)
 * - File-specific properties (dimensions, text layers, transformations)
 * - UI state (selected layers, canvas elements)
 * - Content analysis results (OCR text, entities, tables)
 * - Local storage fields (for caching)
 * - Server synchronization fields (server ID, status, errors)
 */
export type UploadedFile = {
  id: string;
  status: FileUploadStatus;
  filepath?: string;
  filename: string;
  size: number;
  type: string;
  uploadedAt: Date;
  
  // File-specific text layers and image dimensions
  textLayers?: ResizableLayer[];
  imageDimensions?: NumberPair;
  imageScale?: number;
  canvasSize?: NumberPair;
  referenceSize?: NumberPair; // Original image dimensions for scaling calculations (set once at load)

  // Table data for export functionality
  table?: Array<Array<string>>;
  targetColumn?: number;
  targetRow?: number;
  
  // Entities data for export functionality
  entities?: ImageEntity[];

  
  // File-specific transformations
  transform?: {
    flip: NumberPair;
    rotation: number;
    scale: number;
    translation: NumberPair;
  };
  fixedImageRatioKey?: string;
  
  // File-specific UI state
  selectedResizableLayer?: number;
  resizeHandlesContainer?: HTMLDivElement;
  imageCanvas?: HTMLCanvasElement;
  renderingPayload?: any; // TODO: Add proper type
  
  // File-specific content
  resizableLayers?: ResizableLayer[];
  brushDrawnLines?: any[]; // TODO: Add proper type
  adjustments?: Record<string, any>; // TODO: Add proper type
  result?: {
    result?: {
      pageNumber?: string; // номер страницы
      type?: 'архив' | 'форма' | 'опись' | 'дело' | 'не известно'; // тип документа
      textAnnotation?: {
      width: string;
      height: string;
      blocks: Array<{
        boundingBox: {
          vertices: Array<{
            x: string;
            y: string;
          }>;
        };
        lines: Array<{
          boundingBox: {
            vertices: Array<{
              x: string;
              y: string;
            }>;
          };
          text: string;
          words: Array<{
            boundingBox: {
              vertices: Array<{
                x: string;
                y: string;
              }>;
            };
            text: string;
            entityIndex?: string;
            textSegments?: Array<{
              startIndex: string;
              length: string;
            }>;
          }>;
          textSegments?: Array<{
            startIndex: string;
            length: string;
          }>;
          orientation?: string;
        }>;
        languages?: Array<{
          languageCode: string;
        }>;
        textSegments?: Array<{
          startIndex: string;
          length: string;
        }>;
        layoutType?: string;
      }>;
      entities?: Array<ImageEntity>;
      tables?: Array<{
        boundingBox: {
          vertices: Array<{
            x: string;
            y: string;
          }>;
        };
        rowCount: string;
        columnCount: string;
        cells: Array<{
          boundingBox: {
            vertices: Array<{
              x: string;
              y: string;
            }>;
          };
          rowIndex: string;
          columnIndex: string;
          columnSpan?: string;
          rowSpan?: string;
          text: string;
          textSegments?: Array<{
            startIndex: string;
            length: string;
          }>;
        }>;
      }>;
      fullText: string;
      rotate?: string;
      markdown?: string;
      pictures?: Array<{
        boundingBox: {
          vertices: Array<{
            x: string;
            y: string;
          }>;
        };
        score: string;
      }>;
    };
    page?: string;
    };
  };
  error?: string;
  
  // Local storage fields
  localFileName?: string; // Key for cache storage
  
  // Server upload fields
  serverId?: string; // Server-assigned ID
  serverStatus?: FileUploadStatus; // Server processing status
  serverFilepath?: string; // Server file URL
  serverError?: string; // Server-specific error
};

export type EntityType = 'ФИО' | 'место' | 'время' | 'событие' | 'другое';

export type ImageEntity = {
  id: string;
  blockIndex: number;
  text: string;
  startIndex: number;
  endIndex: number;
  type: EntityType;
  createdAt: Date;
};

export type MediaType = 'image' | 'video';

export type ResizableLayer = {
  id: number;
  type: 'text' | 'sticker';
  position: NumberPair;
  rotation: number;
  scale: number;
  width?: number;  // Независимая ширина
  height?: number; // Независимая высота
  baseScale?: number; // Original scale before image-relative adjustments
  baseWidth?: number;
  baseHeight?: number;
  basePosition?: NumberPair; // Original position before image-relative adjustments
  ocrBlockIndex?: number; // Индекс соответствующего OCR блока для синхронизации

  sticker?: Document.document;

  textInfo?: TextLayerInfo;
  textRenderingInfo?: TextRenderingInfo;
};

export type TextRenderingInfo = {
  width: number;
  height: number;

  path?: (number | string)[];
  lines: TextRenderingInfoLine[];
};

export type StickerRenderingInfo = {
  container?: HTMLDivElement;
};

export type TextRenderingInfoLine = {
  left: number;
  right: number;
  height: number;
  content: string;
};

export type FontKey = 'roboto' | 'suez' | 'bubbles' | 'playwrite' | 'chewy' | 'courier' | 'fugaz' | 'sedan';

export type TextLayerInfo = {
  color: string;
  alignment: string;
  style: string;
  size: number;
  font: FontKey;
};

export type ResizableLayerProps = {
  layer: ResizableLayer;
};

export type FontInfo = {
  fontFamily: string;
  fontWeight: number;
  baseline: number;
};

export type StandaloneSignal<T> = {
  dispose: () => void;
  signal: Signal<T>;
};
