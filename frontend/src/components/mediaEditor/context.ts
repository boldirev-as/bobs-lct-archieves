import {Accessor, createContext, createEffect, createSignal, on, useContext, createMemo} from 'solid-js';
import {createMutable, modifyMutable, produce, Store} from 'solid-js/store';

import exceptKeys from '../../helpers/object/exceptKeys';
import throttle from '../../helpers/schedulers/throttle';
import type {ObjectPath} from '../../types';

import type {MediaEditorProps} from './mediaEditor';
import {MediaType, NumberPair, ResizableLayer, StickerRenderingInfo, TextLayerInfo, UploadedFile, GalleryItem} from './types';
import {approximateDeepEqual, snapToAvailableQuality, traverseObjectDeep} from './utils';
import {extractImagesFromPDF} from './pdfImageExtractor';


type EditingMediaStateWithoutHistory = {
  currentImageRatio: number;

  currentVideoTime: number;
  videoCropStart: number;
  videoCropLength: number;
  videoThumbnailPosition: number;
  videoMuted: boolean;
  videoQuality: number;
  
  uploadedFiles: UploadedFile[];
  
  // Thumbnails storage: fileId -> { paragraphId: thumbnail }
  paragraphThumbnails: Record<string, Record<string, string>>;
};

export type EditingMediaState = EditingMediaStateWithoutHistory & {
  history: HistoryItem[];
  redoHistory: HistoryItem[];
};

export type KeyofEditingMediaState = keyof EditingMediaStateWithoutHistory |
  `files.${number}` |
  `files.${number}.result` |
  `files.${number}.result.textAnnotation` |
  `files.${number}.result.textAnnotation.entities` |
  `files.${number}.result.textAnnotation.entities.${number}` |
  'selectedBlock' |
  'entityCreationMode';

export namespace HistoryItem {
  export const RemoveArrayItem = 'SSBiZWxpZXZlIEkgY2FuIGZseSwgSSBiZWxpZXZlIEkgY2FuIHRvdWNoIHRoZSBza3kh'; // Symbol('Remove'); Symbol cannot be structuredClone :(
}

export type HistoryItem = {
  path: KeyofEditingMediaState;
  newValue: any;
  oldValue: any;

  // Resizable layers can change order!
  findBy?: {
    id: any;
  };
};

export type MediaEditorState = {
  isReady: boolean;

  pixelRatio: number;

  currentTab: string;

  currentTextLayerInfo: TextLayerInfo;
  stickersLayersInfo: Record<number, StickerRenderingInfo>;

  // brushCanvas removed for performance optimization

  currentBrush: {
    color: string;
    size: number;
    brush: string;
  };
  previewBrushSize?: number;

  isAdjusting: boolean;
  isMoving: boolean;
  isPlaying: boolean;
  
  // Gallery state
  galleryItems: GalleryItem[];
  currentGalleryIndex: number;
  showGallery: boolean;

  targetFile?: UploadedFile;
  
  // Selected block for entity creation
  selectedBlock?: {blockIndex: number};
  
  // Navigation state for entity creation
  entityCreationMode?: 'list' | 'selectblock' | 'editentity';
  
  // Selected column index for export table
  selectedColumnIndex?: number;
  
  // Cell editing state for disabling UI during edit
  isEditingCell?: boolean;
  
  // Paragraph editing state
  isEditingParagraph?: boolean;
  editingBlockIndex?: number;
  originalLayerState?: any; // Backup of layer state before editing
  
  // Entity editing state
  editingEntityId?: string; // ID of entity being edited
  originalEntityState?: any; // Backup of entity state before editing
  
  // Hover preview state
  hoverPreview?: {
    visible: boolean;
    x: number;
    y: number;
    content?: {
      type: 'paragraph' | 'image';
      text?: string;
      imageSrc?: string;
      boundingBox?: any;
      blockIndex?: number;
    };
  };
  
  // Overlay open state for export tab
  isOverlayOpen?: boolean;
};

export enum SetVideoTimeFlags {
  Redraw = 0b001,
  UpdateCursor = 0b010,
  UpdateVideo = 0b100,
};

export type EditorOverridableGlobalActions = {
  pushToHistory: (item: HistoryItem) => void;
  setInitialImageRatio: (ratio: number) => void;
  redrawBrushes: () => void;
  abortDrawerSlide: () => void;
  resetRotationWheel: () => void;
  setVideoTime: (time: number, flags?: SetVideoTimeFlags) => void;
  uploadFile: (file: File) => Promise<string>;
  deleteFile: (fileId: string) => void;
  retryFileUpload: (fileId: string) => Promise<void>;
  addToGallery: (item: GalleryItem) => void;
  removeFromGallery: (itemId: string) => void;
  setCurrentGalleryItem: (index: number) => void;
  toggleGallery: () => void;
  setTargetFile: (file: UploadedFile | undefined) => void;
  syncTargetFileToMediaState: () => void;
  createEntity: (blockIndex: number, text: string, startIndex: number, endIndex: number, type: import('./types').EntityType) => string;
  deleteEntity: (entityId: string) => void;
  setSelectedBlock: (block: {blockIndex: number} | undefined) => void;
  setEntityCreationMode: (mode: 'list' | 'selectblock' | 'editentity' | undefined) => void;
  addCellToColumn: (columnIndex: number, cellValue: string) => void;
  setSelectedColumnIndex: (columnIndex: number) => void;
  deleteParagraph: (id: number | string) => void;
  setHoverPreview: (preview: {
    visible: boolean;
    x: number;
    y: number;
    content?: {
      type: 'paragraph' | 'image';
      text?: string;
      imageSrc?: string;
      boundingBox?: any;
      blockIndex?: number;
    };
  }) => void;
};


const getDefaultEditingMediaState = (props: MediaEditorProps): EditingMediaState => ({
  currentImageRatio: 0,

  currentVideoTime: 0,
  videoCropStart: 0,
  videoCropLength: 1,
  videoThumbnailPosition: 0,
  videoMuted: false,
  videoQuality: snapToAvailableQuality(props.mediaSize[1]),
  uploadedFiles: [],
  paragraphThumbnails: {},

  history: [],
  redoHistory: []
});

const getDefaultMediaEditorState = (): MediaEditorState => ({
  isReady: false,

  pixelRatio: window.devicePixelRatio,

  currentTab: 'info',

  currentTextLayerInfo: {
    alignment: 'left',
    style: 'outline',
    color: '#ffffff',
    font: 'roboto',
    size: 40
  },
  stickersLayersInfo: {},

  currentBrush: {
    brush: 'pen',
    color: '#fe4438',
    size: 18
  },
  previewBrushSize: undefined,

  isAdjusting: false,
  isMoving: false,
  isPlaying: false,
  
  // Gallery state
  galleryItems: [],
  currentGalleryIndex: 0,
  showGallery: false,

  targetFile: undefined,
  selectedBlock: undefined,
  entityCreationMode: undefined,
  selectedColumnIndex: 0
});

export type MediaEditorContextValue = {
  mediaSrc: string;
  mediaType: MediaType;
  mediaBlob: Blob;
  mediaSize: NumberPair;

  mediaState: Store<EditingMediaState>;
  editorState: Store<MediaEditorState>;
  actions: EditorOverridableGlobalActions;

  hasModifications: Accessor<boolean>;
  imageRatio: number;

  resizableLayersSeed: number;
};


const MediaEditorContext = createContext<MediaEditorContextValue>();

export function createContextValue(props: MediaEditorProps): MediaEditorContextValue {
  const mediaStateInit = props.editingMediaState ?
    structuredClone(props.editingMediaState) : // Prevent mutable store being synchronized with the passed object reference
    getDefaultEditingMediaState(props);

  const mediaStateInitClone = structuredClone(mediaStateInit);


  const mediaState = createMutable(mediaStateInit);
  const editorState = createMutable(getDefaultMediaEditorState());

  const actions: EditorOverridableGlobalActions = {
    pushToHistory: (item: HistoryItem) => {
      modifyMutable(mediaState, produce(({history, redoHistory}) => {
        history.push(item);
        redoHistory.length && redoHistory.splice(0, Infinity);
      }));
    },
    setInitialImageRatio: (ratio: number) => {
      mediaStateInitClone.currentImageRatio = ratio;
    },
    redrawBrushes: () => {},
    abortDrawerSlide: () => {},
    resetRotationWheel: () => {},
    setVideoTime: () => {},
    uploadFile: async (file: File) => {
      if (file.type === 'application/pdf') {
        try {
          console.log('Extracting images from PDF...');
          const extractedImages = await extractImagesFromPDF(file);
          
          // Добавляем каждое извлеченное изображение как отдельный файл
          for (const image of extractedImages) {
            const imageFile = new File([image.blob], image.name, { type: 'image/png' });
            
            // Используем ту же функцию uploadFile для загрузки извлеченного изображения
            await actions.uploadFile(imageFile);
          }
          
          console.log(`Extracted and uploaded ${extractedImages.length} images from PDF`);
        } catch (error) {
          console.error('Error extracting images from PDF:', error);
          // Не прерываем загрузку основного PDF файла
        }

        return;
      }
      
      const tempId = `temp_${Date.now()}`; // Use a temporary ID with prefix
      const uploadedFile: UploadedFile = {
        id: tempId,
        status: 'pending',
        filename: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date(),
        filepath: URL.createObjectURL(file) // Local preview
      };
      
      // Add file to the list with loading status
      modifyMutable(mediaState, produce(state => {
        state.uploadedFiles.push(uploadedFile);
      }));
      
      // If this is the first file and no targetFile is set, select it
      if (mediaState.uploadedFiles.length === 1 && !editorState.targetFile) {
        modifyMutable(editorState, produce(state => {
          state.targetFile = uploadedFile;
        }));
      }
      
      try {
        // Upload to server
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/api/upload-doc', {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }
        
        const result = await response.json();
        const serverId = result.id;
        
        // Update file with server ID - polling will be handled by ArchiveFileItem component
        modifyMutable(mediaState, produce(state => {
          const uploadedFile = state.uploadedFiles.find(f => f.id === tempId);
          if (uploadedFile) {
            uploadedFile.id = serverId; // Replace temp ID with server ID
            uploadedFile.status = 'processing'; // Server is processing
          }
        }));
        
        return serverId;
      } catch (error) {
        // Update status to error
        modifyMutable(mediaState, produce(state => {
          const file = state.uploadedFiles.find(f => f.id === tempId);
          if (file) {
            file.status = 'error';
            file.error = error instanceof Error ? error.message : String(error);
          }
        }));
        throw error;
      }
    },
    deleteFile: (fileId: string) => {
      modifyMutable(mediaState, produce(state => {
        const index = state.uploadedFiles.findIndex(f => f.id === fileId);
        if (index !== -1) {
          const file = state.uploadedFiles[index];
          
          // Clean up local URL
          if (file.filepath && file.filepath.startsWith('blob:')) {
            URL.revokeObjectURL(file.filepath);
          }
          
          state.uploadedFiles.splice(index, 1);
        }
      }));
    },
    retryFileUpload: async (fileId: string) => {
      // Simplified retry logic: just remove the failed entry and let user re-upload
      modifyMutable(mediaState, produce(state => {
        const index = state.uploadedFiles.findIndex(f => f.id === fileId);
        if (index !== -1) {
          state.uploadedFiles.splice(index, 1);
        }
      }));
    },
    deleteParagraph: (blockIndex: number) => {
      if (!editorState.targetFile?.textLayers) return;
      
      modifyMutable(editorState, produce(state => {
        if (state.targetFile?.textLayers) {
          // Find and remove the layer with matching ocrBlockIndex
          const layerIndex = state.targetFile.textLayers.findIndex(layer => 
            layer.ocrBlockIndex === blockIndex
          );
          
          if (layerIndex !== -1) {
            // Remove the layer
            state.targetFile.textLayers.splice(layerIndex, 1);
            
            // Update ocrBlockIndex for remaining layers
            state.targetFile.textLayers.forEach(layer => {
              if (layer.ocrBlockIndex > blockIndex) {
                layer.ocrBlockIndex = layer.ocrBlockIndex - 1;
              }
            });
            
            if (state.targetFile.result?.result?.textAnnotation?.blocks) {
              const blocks = state.targetFile.result.result.textAnnotation.blocks;
              if (blockIndex >= 0 && blockIndex < blocks.length) {
                blocks.splice(blockIndex, 1);
                
                const fullText = state.targetFile.textLayers
                  .filter(layer => layer.type === 'text' && layer.textInfo)
                  .map(layer => {
                    return layer.textRenderingInfo?.lines?.map(line => line.content).join('\n') || 
                           (layer.textInfo ? 'Текст слоя' : '');
                  })
                  .join('\n\n');
                
                if (state.targetFile.result.result.textAnnotation) {
                  state.targetFile.result.result.textAnnotation.fullText = fullText;
                }
              }
            }
          }
        }
      }));
    },
    addToGallery: (item: GalleryItem) => {
      modifyMutable(editorState, produce(state => {
        state.galleryItems.push(item);
      }));
    },
    removeFromGallery: (itemId: string) => {
      modifyMutable(editorState, produce(state => {
        const index = state.galleryItems.findIndex(item => item.id === itemId);
        if (index !== -1) {
          state.galleryItems.splice(index, 1);
          // Adjust current index if necessary
          if (state.currentGalleryIndex >= state.galleryItems.length) {
            state.currentGalleryIndex = Math.max(0, state.galleryItems.length - 1);
          }
        }
      }));
    },
    setCurrentGalleryItem: (index: number) => {
      modifyMutable(editorState, produce(state => {
        if (index >= 0 && index < state.galleryItems.length) {
          state.currentGalleryIndex = index;
        }
      }));
    },
    toggleGallery: () => {
      modifyMutable(editorState, produce(state => {
        state.showGallery = !state.showGallery;
      }));
    },
    setTargetFile: (file: UploadedFile | undefined) => {
      // Only update editorState.targetFile
      // Sync to mediaState will happen on export tab unmount
      modifyMutable(editorState, produce(state => {
        state.targetFile = file;
      }));
    },
    syncTargetFileToMediaState: () => {
      // Sync current targetFile back to mediaState.uploadedFiles
      if (editorState.targetFile) {
        const fileId = editorState.targetFile.id;
        modifyMutable(mediaState, produce(state => {
          const index = state.uploadedFiles.findIndex(f => f.id === fileId);
          if (index !== -1) {
            state.uploadedFiles[index] = editorState.targetFile!;
            console.log('syncTargetFileToMediaState:', { 
              fileId, 
              tableLength: editorState.targetFile!.table?.length 
            });
          }
        }));
      }
    },
    createEntity: (blockIndex: number, text: string, startIndex: number, endIndex: number, type: import('./types').EntityType) => {
      const newEntity = {
        id: `entity_${Date.now()}`,
        blockIndex,
        text,
        startIndex,
        endIndex,
        type,
        createdAt: new Date()
      };
      
      modifyMutable(mediaState, produce(state => {
        const targetFile = state.uploadedFiles.find(f => f.id === editorState.targetFile?.id);
        console.log(JSON.stringify(targetFile.result.result.textAnnotation, null, 2), "HELP!!!");
        if (targetFile && targetFile.result?.result?.textAnnotation) {
          if (!targetFile.result.result.textAnnotation.entities) {
            targetFile.result.result.textAnnotation.entities = [];
          }
          targetFile.result.result.textAnnotation.entities.push(newEntity);
        }
      }));
      
      return newEntity.id;
    },
    deleteEntity: (entityId: string) => {
      modifyMutable(mediaState, produce(state => {
        const targetFile = state.uploadedFiles.find(f => f.id === editorState.targetFile?.id);
        if (targetFile && targetFile.result?.result?.textAnnotation?.entities) {
          const index = targetFile.result.result.textAnnotation.entities.findIndex(e => e.id === entityId);
          if (index !== -1) {
            targetFile.result.result.textAnnotation.entities.splice(index, 1);
          }
        }
      }));
    },
    setSelectedBlock: (block: {blockIndex: number} | undefined) => {
      modifyMutable(editorState, produce(state => {
        state.selectedBlock = block;
      }));
    },
    setEntityCreationMode: (mode: 'list' | 'selectblock' | 'editentity' | undefined) => {
      modifyMutable(editorState, produce(state => {
        state.entityCreationMode = mode;
      }));
    },
    addCellToColumn: (columnIndex: number, cellValue: string) => {
      console.log('addCellToColumn called:', { columnIndex, cellValue });
      
      if (editorState.isEditingCell) {
        return;
      }
      
      if (editorState.targetFile) {
        // Work with the current targetFile directly
        const currentTable = editorState.targetFile.table || [['Название колонки']];
        const newTable = currentTable.map(column => [...column]); // Deep copy each column
        
        console.log('addCellToColumn - before:', { 
          columnIndex, 
          cellValue, 
          currentTableLength: currentTable.length 
        });
        
        // Ensure column exists
        while (newTable.length <= columnIndex) {
          const newColumnName = `Колонка ${newTable.length + 1}`;
          newTable.push([newColumnName]); // New column with just header
          console.log('Created new column:', newColumnName);
        }
        
        // Add cell value to the specified column (push to end)
        newTable[columnIndex].push(cellValue);
        console.log('addCellToColumn - after:', { 
          newTableLength: newTable.length,
          columnLength: newTable[columnIndex].length 
        });
        
        // Update through setTargetFile which syncs both states
        const updatedFile = {
          ...editorState.targetFile,
          table: newTable
        };
        
        actions.setTargetFile(updatedFile);
      }
    },
    setSelectedColumnIndex: (columnIndex: number) => {
      modifyMutable(editorState, produce(state => {
        state.selectedColumnIndex = columnIndex;
      }));
    },
    
    setHoverPreview: (preview: {
      visible: boolean;
      x: number;
      y: number;
      content?: {
        type: 'paragraph' | 'image';
        text?: string;
        imageSrc?: string;
        boundingBox?: any;
        blockIndex?: number;
      };
    }) => {
      console.log('setHoverPreview called with:', preview);
      modifyMutable(editorState, produce(state => {
        state.hoverPreview = preview;
        console.log('Updated hoverPreview state:', state.hoverPreview);
      }));
    }
  };

  const [hasModifications, setHasModifications] = createSignal(false);

  const keysToExcept = ['history', 'redoHistory', 'currentVideoTime', 'uploadedFiles'] satisfies (keyof EditingMediaState)[];

  const throttledUpdateHasModifications = throttle(() => {
    setHasModifications(
      !approximateDeepEqual(
        exceptKeys(mediaStateInitClone, keysToExcept),
        exceptKeys(mediaState, keysToExcept)
      )
    );
  }, 200, false);

  createEffect(on(() => traverseObjectDeep(exceptKeys(mediaState, keysToExcept)), () => {
    throttledUpdateHasModifications();
  }));

  // Gallery starts empty - items will be added when files are uploaded

  // (window as any).mediaState = mediaState;
  // (window as any).unwrap = unwrap;

  return {
    mediaSrc: props.mediaSrc,
    mediaType: props.mediaType,
    mediaBlob: props.mediaBlob,
    mediaSize: props.mediaSize,

    mediaState,
    editorState,
    actions,

    hasModifications,
    imageRatio: props.mediaSize[0] / props.mediaSize[1],

    // [0-1] make sure it's different even after reopening the editor, note that there might be some items in history!
    resizableLayersSeed: Math.random()
  };
}

export const useMediaEditorContext = () => useContext(MediaEditorContext);

export default MediaEditorContext;
