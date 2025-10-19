import {onMount, Accessor, JSX, createEffect, untrack, Show, createMemo, createSignal, For, onCleanup} from 'solid-js';


import ripple from '../../ripple'; ripple;
import {IconTsx} from '../../iconTsx';
import Space from '../../space';

import {createStoredColor} from '../createStoredColor';
import {useMediaEditorContext} from '../context';
import ColorPicker from '../colorPicker';
import LargeButton from '../largeButton';
import RangeInput from '../rangeInput';
import DoubleRangeSlider from '../doubleRangeSlider';
import {fontInfoMap} from '../utils';
import {FontKey, EntityType} from '../types';
import TabContent from './tabContent';
import { ScrollableYTsx } from '../../chat/topbarSearch';
import EditLineTab from './editLineTab';
import BottomButton from '../bottomButton';
import { useParagraphThumbnails } from '../useParagraphThumbnails';

type TextTabMode = 'full' | 'paragraphs' | 'entitycreate' | 'entities' | 'editline';

// Function to get emoji for entity type
const getEntityTypeEmoji = (type: EntityType): string => {
  switch (type) {
    case 'ФИО': return '👤';
    case 'место': return '📍';
    case 'время': return '⏰';
    case 'событие': return '📅';
    case 'другое': return '📝';
    default: return '📝';
  }
};

export default function TextTab() {
  const {editorState, actions} = useMediaEditorContext();
  
  // Tab mode state
  const [currentMode, setCurrentMode] = createSignal<TextTabMode>('full');
  
  // Paragraph thumbnails hook
  const paragraphThumbnails = useParagraphThumbnails();

  // Effect to switch to entity creation mode when block is selected
  createEffect(() => {
    if (editorState.entityCreationMode === 'editentity' && editorState.selectedBlock) {
      setCurrentMode('entitycreate');
    }
  });

  // Extract OCR text from target file
  const ocrText = createMemo(() => {
    if (!editorState.targetFile?.result?.result?.textAnnotation) {
      console.log('No textAnnotation found in:', editorState.targetFile?.result);
      return null;
    }

    const textAnnotation = editorState.targetFile.result.result.textAnnotation;
    console.log('Found textAnnotation:', textAnnotation);
    
    if (textAnnotation.blocks && textAnnotation.blocks.length > 0) {
      return textAnnotation.blocks
        .map((block: any) => {
          if (block.lines && block.lines.length > 0) {
            return block.lines
              .map((line: any) => {
                if (line.words && line.words.length > 0) {
                  return line.words
                    .map((word: any) => word.text || '')
                    .join(' ');
                }
                return line.text || '';
              })
              .join('\n');
          }
          return block.text || '';
        })
        .join('\n\n');
    }

    // Fallback - no text found
    return 'Текст не распознан';
  });

  // Extract paragraphs (blocks)
  const ocrParagraphs = createMemo(() => {
    if (!editorState.targetFile?.result?.result?.textAnnotation?.blocks) {
      return [];
    }

    return editorState.targetFile.result.result.textAnnotation.blocks.map((block: any, index: number) => {
      const text = block.lines?.map((line: any) => {
        return line.words?.map((word: any) => word.text || '').join(' ') || line.text || '';
      }).join('\n') || block.text || '';
      
      return {
        id: index,
        text: text,
        boundingBox: block.boundingBox
      };
    });
  });

  // Extract images/visual elements from OCR results
  const ocrImages = createMemo((): any[] => {
    console.log('OCR Images Debug:', {
      targetFile: editorState.targetFile,
      result: editorState.targetFile?.result,
      textAnnotation: editorState.targetFile?.result?.result?.textAnnotation,
      pictures: editorState.targetFile?.result?.result?.textAnnotation?.pictures
    });
    
    if (!editorState.targetFile?.result?.result?.textAnnotation?.pictures) {
      console.log('No pictures found in OCR data');
      return [];
    }
    
    const images = editorState.targetFile.result.result.textAnnotation.pictures.map((picture: any, index: number) => ({
      id: index,
      boundingBox: picture.boundingBox,
      score: picture.score,
      // Calculate position and dimensions
      x: parseInt(picture.boundingBox.vertices[0].x),
      y: parseInt(picture.boundingBox.vertices[0].y),
      width: Math.abs(parseInt(picture.boundingBox.vertices[2].x) - parseInt(picture.boundingBox.vertices[0].x)),
      height: Math.abs(parseInt(picture.boundingBox.vertices[2].y) - parseInt(picture.boundingBox.vertices[0].y))
    }));
    
    console.log('Processed images:', images);
    return images;
  });

  // Function to find images that overlap with a paragraph
  const getImagesForParagraph = (paragraphBoundingBox: any) => {
    if (!paragraphBoundingBox?.vertices) {
      console.log('No paragraph bounding box vertices');
      return [];
    }
    
    const paragraphX1 = parseInt(paragraphBoundingBox.vertices[0].x);
    const paragraphY1 = parseInt(paragraphBoundingBox.vertices[0].y);
    const paragraphX2 = parseInt(paragraphBoundingBox.vertices[2].x);
    const paragraphY2 = parseInt(paragraphBoundingBox.vertices[2].y);
    
    console.log('Paragraph bounds:', { paragraphX1, paragraphY1, paragraphX2, paragraphY2 });
    console.log('All OCR images:', ocrImages());
    
    const matchingImages = ocrImages().filter(image => {
      const imageX1 = image.x;
      const imageY1 = image.y;
      const imageX2 = image.x + image.width;
      const imageY2 = image.y + image.height;
      
      // Check if image overlaps with paragraph (with some tolerance)
      const tolerance = 20;
      const overlaps = !(imageX2 < paragraphX1 - tolerance || 
               imageX1 > paragraphX2 + tolerance || 
               imageY2 < paragraphY1 - tolerance || 
               imageY1 > paragraphY2 + tolerance);
      
      console.log('Image overlap check:', {
        image: { x: imageX1, y: imageY1, width: image.width, height: image.height },
        paragraph: { x1: paragraphX1, y1: paragraphY1, x2: paragraphX2, y2: paragraphY2 },
        overlaps
      });
      
      return overlaps;
    });
    
    console.log('Matching images for paragraph:', matchingImages);
    return matchingImages;
  };

  // Full text component
  const FullTextMode = () => (
    <div class="media-editor__ocr-content">
      <div style="position: sticky; left: 0; top: -8px; background-color: #212121; z-index: 10" class="media-editor__edit-line-editor-header">
        <div style="margin-left: 8px" class="media-editor__edit-line-editor-title">
          Текст
        </div>
      </div>
      <div class="media-editor__ocr-text">
        <textarea 
          class="media-editor__ocr-textarea"
          value={ocrText() || ''}
          placeholder="Текст не распознан"
          readonly
        />
      </div>
    </div>
  );

  const ParagraphsMode = () => {
    const handleParagraphClick = (blockIndex: number) => {
      // Сохраняем оригинальное состояние слоя перед редактированием
      if (editorState.targetFile?.textLayers) {
        const layer = editorState.targetFile.textLayers.find(l => l.ocrBlockIndex === blockIndex);
        if (layer) {
          // Deep copy of layer state
          editorState.originalLayerState = JSON.parse(JSON.stringify(layer));
        }
      }
      
      // Выбираем блок для редактирования
      editorState.selectedBlock = {blockIndex};
      editorState.isEditingParagraph = true;
      editorState.editingBlockIndex = blockIndex;
      setCurrentMode('editline');
    };

    const handleParagraphHover = (blockIndex: number) => {
      // Имитируем состояние редактирования при наведении
      editorState.selectedBlock = {blockIndex};
      editorState.isEditingParagraph = true;
      editorState.editingBlockIndex = blockIndex;
    };

    const handleParagraphLeave = () => {
      // Сбрасываем состояние при уходе курсора
      editorState.selectedBlock = undefined;
      editorState.isEditingParagraph = false;
      editorState.editingBlockIndex = undefined;
    };
    
    const handleAddParagraph = () => {
      if (!editorState.targetFile) return;
      
      const file = editorState.targetFile;
      
      // Ensure OCR structure exists
      if (!file.result) {
        file.result = {result: {textAnnotation: {blocks: [], width: '800', height: '600', fullText: ''}}};
      }
      if (!file.result.result) {
        file.result.result = {textAnnotation: {blocks: [], width: '800', height: '600', fullText: ''}};
      }
      if (!file.result.result.textAnnotation) {
        file.result.result.textAnnotation = {blocks: [], width: '800', height: '600', fullText: ''};
      }
      if (!file.result.result.textAnnotation.blocks) {
        file.result.result.textAnnotation.blocks = [];
      }
      
      const blocks = file.result.result.textAnnotation.blocks;
      const newBlockIndex = blocks.length;
      
      // Get image dimensions for positioning
      const imageWidth = parseInt(file.result.result.textAnnotation.width) || file.imageDimensions?.[0] || 800;
      const imageHeight = parseInt(file.result.result.textAnnotation.height) || file.imageDimensions?.[1] || 600;
      
      // Position new block in center
      const blockWidth = 300;
      const blockHeight = 100;
      const left = (imageWidth - blockWidth) / 2;
      const top = (imageHeight - blockHeight) / 2;
      
      // Create new OCR block
      const newBlock = {
        boundingBox: {
          vertices: [
            {x: left.toString(), y: top.toString()},
            {x: (left + blockWidth).toString(), y: top.toString()},
            {x: (left + blockWidth).toString(), y: (top + blockHeight).toString()},
            {x: left.toString(), y: (top + blockHeight).toString()}
          ]
        },
        lines: [
          {
            text: 'Новый абзац',
            words: [{text: 'Новый абзац', boundingBox: {vertices: []}}],
            boundingBox: {vertices: []},
            textSegments: []
          }
        ]
      };
      
      blocks.push(newBlock);
      
      // Create new text layer
      if (!file.textLayers) {
        file.textLayers = [];
      }
      
      const newLayer = {
        id: Date.now() + Math.random(),
        type: 'text' as const,
        position: [left, top] as [number, number],
        basePosition: [left, top] as [number, number],
        rotation: 0,
        scale: 1,
        baseScale: 1,
        width: blockWidth,
        height: blockHeight,
        baseWidth: blockWidth,
        baseHeight: blockHeight,
        ocrBlockIndex: newBlockIndex,
        textInfo: {
          font: 'roboto' as any,
          size: 24,
          color: '#ffffff',
          alignment: 'left' as const,
          style: 'normal' as const
        },
        textRenderingInfo: {
          width: blockWidth,
          height: blockHeight,
          lines: [{
            left: 0,
            right: blockWidth,
            content: 'Новый абзац',
            height: blockHeight
          }]
        }
      };
      
      file.textLayers.push(newLayer);
      
      // Mark as new paragraph (not saved yet)
      editorState.originalLayerState = {isNew: true, blockIndex: newBlockIndex};
      
      // Open editor for new paragraph
      editorState.selectedBlock = {blockIndex: newBlockIndex};
      editorState.isEditingParagraph = true;
      editorState.editingBlockIndex = newBlockIndex;
      setCurrentMode('editline');
    };

    return (
      <>
        <ScrollableYTsx>
          <div class="media-editor__ocr-content">
            <div class="media-editor__ocr-paragraphs">
              <div style="position: sticky; left: 0; top: -8px; background-color: #212121; z-index: 10" class="media-editor__edit-line-editor-header">
                <div style="margin-left: 8px" class="media-editor__edit-line-editor-title">
                  Абзацы
                </div>
              </div>
              <Show
                when={ocrParagraphs().length > 0}
                fallback={
                  <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; text-align: center; min-height: 200px;">
                    <div style="font-size: 4rem; margin-bottom: 1rem; opacity: 0.7;">📁</div>
                    <div style="color: var(--secondary-text-color); font-size: 0.9rem; font-weight: 400; line-height: 1.4;">Абзацы не найдены</div>
                  </div>
                }
              >
                {ocrParagraphs().map((paragraph, index) => {
                  const paragraphImages = getImagesForParagraph(paragraph.boundingBox);
                  console.log(`Paragraph ${index} images:`, paragraphImages);
                  console.log(`Paragraph ${index} details:`, {
                    id: paragraph.id,
                    text: paragraph.text.substring(0, 50) + '...',
                    boundingBox: paragraph.boundingBox
                  });
                  
                  // Get thumbnail for this paragraph
                  const [thumbnail, setThumbnail] = createSignal<string | null>(null);
                  
                  // Load thumbnail when component mounts
                  createEffect(async () => {
                    console.log('TextTab: Loading thumbnail for paragraph:', paragraph.id, 'index:', index);
                    const thumb = await paragraphThumbnails.getThumbnail(paragraph.id);
                    console.log('TextTab: Received thumbnail for paragraph:', paragraph.id, 'thumbnail:', !!thumb);
                    setThumbnail(thumb);
                  });
                  
                  return (
                    <div
                      class="media-editor__ocr-paragraph-wrapper"
                      onMouseEnter={() => handleParagraphHover(paragraph.id)}
                      onMouseLeave={handleParagraphLeave}
                    >
                      <div onClick={() => handleParagraphClick(paragraph.id)} use:ripple class="media-editor__ocr-paragraph">
                        <div class="media-editor__ocr-paragraph-content">
                          <Show when={thumbnail()}>
                            <div class="media-editor__ocr-paragraph-thumbnail">
                              <img 
                                src={thumbnail()!} 
                                alt={`Миниатюра абзаца ${index + 1}`}
                                style="
                                  width: 100%;
                                  height: 60px;
                                  object-fit: contain;
                                  border-radius: 8px;
                                  border: 2px solid var(--primary-color);
                                  background: #f0f0f0;
                                "
                              />
                            </div>
                          </Show>
                          <div style="font-size: 12px; color: #666; margin-top: 4px;">
                            Thumbnail: {thumbnail() ? 'YES' : 'NO'} (paragraph {paragraph.id})
                          </div>
                          <div class="media-editor__ocr-paragraph-text">
                            {paragraph.text}
                          </div>
                        </div>
                        <Show when={paragraphImages.length > 0}>
                          <div class="media-editor__ocr-paragraph-images">
                            <div class="media-editor__ocr-paragraph-images-header">
                              <IconTsx icon="image" />
                              <span>Изображения ({paragraphImages.length})</span>
                            </div>
                            <div class="media-editor__ocr-paragraph-images-list">
                              <For each={paragraphImages}>
                                {(image) => (
                                  <div 
                                    class="media-editor__ocr-paragraph-image"
                                    style={`
                                      width: ${Math.min(image.width, 120)}px;
                                      height: ${Math.min(image.height, 120)}px;
                                      background: linear-gradient(45deg, #f0f0f0 25%, transparent 25%), 
                                                  linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), 
                                                  linear-gradient(45deg, transparent 75%, #f0f0f0 75%), 
                                                  linear-gradient(-45deg, transparent 75%, #f0f0f0 75%);
                                      background-size: 20px 20px;
                                      background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
                                      border: 2px solid var(--primary-color);
                                      border-radius: 8px;
                                      display: flex;
                                      align-items: center;
                                      justify-content: center;
                                      position: relative;
                                      overflow: hidden;
                                    `}
                                    title={`Изображение ${image.id + 1} (${image.width}x${image.height}px)`}
                                  >
                                    <div style="
                                      position: absolute;
                                      top: 4px;
                                      right: 4px;
                                      background: var(--primary-color);
                                      color: white;
                                      padding: 2px 6px;
                                      border-radius: 4px;
                                      font-size: 10px;
                                      font-weight: 500;
                                    ">
                                      {Math.round(parseFloat(image.score) * 100)}%
                                    </div>
                                    <div style="
                                      display: flex;
                                      flex-direction: column;
                                      align-items: center;
                                      gap: 4px;
                                      color: var(--secondary-text-color);
                                      font-size: 12px;
                                    ">
                                      <IconTsx icon="image" />
                                      <span>{image.width}×{image.height}</span>
                                    </div>
                                  </div>
                                )}
                              </For>
                            </div>
                          </div>
                        </Show>
                      </div>
                    </div>
                  );
                })}
              </Show>
            </div>
          </div>
        </ScrollableYTsx>
        
        <BottomButton
          icon="plus"
          onClick={handleAddParagraph}
          style="bottom: 120px"
        >
          Добавить абзац
        </BottomButton>
      </>
    );
  };

  const EntitiesListMode = () => {
    // Get existing entities from current file
    const existingEntities = () => {
      return editorState.targetFile?.result?.result?.textAnnotation?.entities || [];
    };

    const handleEntityClick = (entity: any) => {
      // Save original entity state before editing
      editorState.originalEntityState = JSON.parse(JSON.stringify(entity));
      editorState.editingEntityId = entity.id;
      
      // Set the block that contains this entity
      actions.setSelectedBlock({ blockIndex: entity.blockIndex });
      
      // Open entity creation/editing mode
      setCurrentMode('entitycreate');
      actions.setEntityCreationMode('selectblock');
    };
    
    const handleDeleteEntity = (entityId: string) => {
      actions.deleteEntity(entityId);
    };

    const handleCreateNewEntity = () => {
      setCurrentMode('entitycreate');
      actions.setEntityCreationMode('selectblock');
      actions.setSelectedBlock({ blockIndex: 0 });
    };

    return (
      <>
        <ScrollableYTsx>
          <div class="media-editor__ocr-content">
            <div style="position: sticky; left: 0; top: -8px; background-color: #212121; z-index: 10" class="media-editor__edit-line-editor-header">
              <div style="margin-left: 8px" class="media-editor__edit-line-editor-title">
                Образы
              </div>
            </div>
            <div class="media-editor__ocr-entities">
              <Show
                when={existingEntities().length > 0}
                fallback={
                  <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; text-align: center; min-height: 200px;">
                    <div style="font-size: 4rem; margin-bottom: 1rem; opacity: 0.7;">📁</div>
                    <div style="color: var(--secondary-text-color); font-size: 0.9rem; font-weight: 400; line-height: 1.4;">Образы не найдены</div>
                  </div>
                }
              >
                <For each={existingEntities()}>
                  {(entity) => (
                    <div
                      class="media-editor__ocr-paragraph-wrapper"
                    >
                      <div onClick={() => handleEntityClick(entity)} use:ripple class="media-editor__ocr-paragraph">
                        <div class="media-editor__ocr-paragraph-text">
                          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                            <span style="font-size: 16px;">
                              {getEntityTypeEmoji(entity.type || 'другое')}
                            </span>
                            <span style="font-size: 12px; color: var(--secondary-text-color); font-weight: 500;">
                              {entity.type || 'другое'}
                            </span>
                          </div>
                          {entity.text}
                        </div>
                      </div>
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </div>
        </ScrollableYTsx>
        
        <BottomButton
          onClick={handleCreateNewEntity}
          style="bottom: 120px"
        >
          Создать
        </BottomButton>
      </>
    );
  };

  // Entities creation component for selected block
  const EntitiesMode = () => {
    // State for double slider values (start and end)
    const [sliderValues, setSliderValues] = createSignal<{start: number, end: number}>({start: 0, end: 0});
    
    // State for entity type selection
    const [selectedEntityType, setSelectedEntityType] = createSignal<EntityType>('другое');
    
    // Check if we're editing an existing entity
    const isEditingExisting = () => !!editorState.editingEntityId;
    
    // Initialize slider values when block is selected
    createEffect(() => {
      const block = selectedBlock();
      if (block) {
        const charCount = getBlockCharCount();
        
        // If editing existing entity, initialize with its values
        if (isEditingExisting() && editorState.originalEntityState) {
          setSliderValues({
            start: editorState.originalEntityState.startIndex,
            end: editorState.originalEntityState.endIndex
          });
          setSelectedEntityType(editorState.originalEntityState.type || 'другое');
        } else {
          // New entity - select all text
          setSliderValues({start: 0, end: charCount});
        }
      }
    });
    
    // Get selected block from editorState
    const selectedBlock = () => {
      const selected = editorState.selectedBlock;
      return selected ? ocrParagraphs()[selected.blockIndex] : null;
    };
    
    // Get character count for selected block
    const getBlockCharCount = () => {
      const block = selectedBlock();
      return block?.text?.length || 0;
    };
    
    // Get highlighted text based on slider values
    const getHighlightedText = () => {
      const block = selectedBlock();
      if (!block) return '';
      
      const text = block.text || '';
      const {start, end} = sliderValues();
      
      const beforePart = text.substring(0, start);
      const highlightedPart = text.substring(start, end);
      const afterPart = text.substring(end);
      
      return (
        <>
          <span>{beforePart}</span>
          <span class="media-editor__entity-highlighted" style="background-color: var(--primary-color); border-radius: 2px;">
            {highlightedPart}
          </span>
          <span>{afterPart}</span>
        </>
      );
    };
    
    // Handle slider change for start position
    const handleStartSliderChange = (value: number) => {
      setSliderValues(prev => ({
        ...prev,
        start: prev.end === Math.min(value, prev.end) ? prev.start : Math.min(value, prev.end)
      }));
    };
    
    // Handle slider change for end position
    const handleEndSliderChange = (value: number) => {
      setSliderValues(prev => ({
        ...prev,
        end: prev.start === Math.max(value, prev.start) ? prev.end : Math.max(value, prev.start)
      }));
    };
    
    // Create or update entity from selected text
    const handleCreateEntity = () => {
      const block = selectedBlock();
      const selected = editorState.selectedBlock;
      
      if (block && selected) {
        const {start, end} = sliderValues();
        const selectedText = block.text.substring(start, end);
        
        if (selectedText.trim()) {
          if (isEditingExisting() && editorState.editingEntityId) {
            // Update existing entity
            if (editorState.targetFile?.result?.result?.textAnnotation?.entities) {
              const entities = editorState.targetFile.result.result.textAnnotation.entities;
              const entityIndex = entities.findIndex(e => e.id === editorState.editingEntityId);
              
              if (entityIndex !== -1) {
                entities[entityIndex] = {
                  ...entities[entityIndex],
                  text: selectedText,
                  startIndex: start,
                  endIndex: end,
                  type: selectedEntityType()
                };
              }
            }
            
            console.log('Updated entity with ID:', editorState.editingEntityId);
          } else {
            // Create new entity using context action
            const entityId = actions.createEntity(
              selected.blockIndex,
              selectedText,
              start,
              end,
              selectedEntityType()
            );
            
            console.log('Created entity with ID:', entityId);
          }
          
          // Clear editing state
          editorState.editingEntityId = undefined;
          editorState.originalEntityState = undefined;
          
          // Reset state and go back to entities mode
          actions.setSelectedBlock(undefined);
          actions.setEntityCreationMode(undefined);
          setSliderValues({start: 0, end: 0});
          setCurrentMode('entities');
        }
      }
    };
    
    return (
      <>
        <ScrollableYTsx>
          <div class="media-editor__ocr-content">
            <div style="position: sticky; left: 0; top: -8px; background-color: #212121; z-index: 10" class="media-editor__edit-line-editor-header">
              <button
                class="media-editor__edit-line-back-btn"
                onClick={() => {
                  // Restore original entity state if editing
                  if (isEditingExisting() && editorState.originalEntityState && editorState.targetFile) {
                    const entities = editorState.targetFile.result?.result?.textAnnotation?.entities;
                    if (entities) {
                      const entityIndex = entities.findIndex(e => e.id === editorState.editingEntityId);
                      if (entityIndex !== -1) {
                        // Restore original entity
                        entities[entityIndex] = editorState.originalEntityState;
                      }
                    }
                  }
                  
                  // Clear editing state
                  editorState.editingEntityId = undefined;
                  editorState.originalEntityState = undefined;
                  
                  actions.setSelectedBlock(undefined);
                  actions.setEntityCreationMode(undefined);
                  setSliderValues({start: 0, end: 0});
                  setCurrentMode('entities');
                }}
                use:ripple
                title="Назад"
              >
                <IconTsx icon="left" />
              </button>
              <div style="margin-left: -8px" class="media-editor__edit-line-editor-title">
                {isEditingExisting() ? 'Редактирование образа' : 'Создание образа'}
              </div>
            </div>
            
            <Show when={selectedBlock()}>
              <div class="media-editor__entity-creation">
                <div class="media-editor__entity-text-preview">
                  <div class="media-editor__entity-text-content">
                    {getHighlightedText()}
                  </div>
                </div>

                <div class="media-editor__entity-sliders">
                  <DoubleRangeSlider
                    label={""}
                    startValue={sliderValues().start}
                    endValue={sliderValues().end}
                    min={0}
                    max={getBlockCharCount()}
                    onStartChange={handleStartSliderChange}
                    onEndChange={handleEndSliderChange}
                  />
                </div>
                
                <div class="media-editor__entity-type-selector">
                  <div class="media-editor__label">Тип образа</div>
                  <div class="media-editor__radio-group">
                    <For each={['ФИО', 'место', 'время', 'событие', 'другое'] as EntityType[]}>
                      {(type) => (
                        <label
                          class="media-editor__radio-item rp"
                          use:ripple
                        >
                          <input
                            type="radio"
                            name="entity-type"
                            value={type}
                            checked={selectedEntityType() === type}
                            onChange={() => setSelectedEntityType(type)}
                          />
                          <div class="media-editor__radio-content">
                            <div class="media-editor__radio-circle">
                              <div class="media-editor__radio-inner"></div>
                            </div>
                            <span class="media-editor__radio-text">
                              <span style="margin-right: 8px; font-size: 16px;">
                                {getEntityTypeEmoji(type)}
                              </span>
                              {type}
                            </span>
                          </div>
                        </label>
                      )}
                    </For>
                  </div>
                </div>
              </div>
            </Show>
          </div>
        </ScrollableYTsx>
        
        <BottomButton
          onClick={handleCreateEntity}
          disabled={sliderValues().start === sliderValues().end}
          style="bottom: 120px"
        >
          {isEditingExisting() ? 'Сохранить' : 'Создать образ'}
        </BottomButton>
      </>
    );
  };

  // Mode switcher component
  const ModeSwitcher = () => (
    <div class="media-editor__text-mode-switcher">
      <button
        class="media-editor__text-mode-btn"
        classList={{'media-editor__text-mode-btn--active': currentMode() === 'full'}}
        onClick={() => setCurrentMode('full')}
        use:ripple
      >
        <IconTsx icon="menu" />
        <span>Полный текст</span>
      </button>
      <div class="media-editor__text-mode-switcher-inner">
        <button
          class="media-editor__text-mode-btn"
          classList={{'media-editor__text-mode-btn--active': currentMode() === 'paragraphs'}}
          onClick={() => setCurrentMode('paragraphs')}
          use:ripple
        >
          <IconTsx icon="text" />
          <span>Абзацы</span>
        </button>
        <button
          class="media-editor__text-mode-btn"
          classList={{'media-editor__text-mode-btn--active': currentMode() === 'entities'}}
          onClick={() => setCurrentMode('entities')}
          use:ripple
        >
          <IconTsx icon="image" />
          <span>Образы</span>
        </button>
      </div>
    </div>
  );

  const [savedColor, setSavedColor] = createStoredColor('media-editor-text-color', '#ffffff');

  editorState.currentTextLayerInfo.color = savedColor().value;
  createEffect(() => {
    untrack(() => editorState.currentTextLayerInfo).color = savedColor().value;
  });

  onMount(() => {
    document.querySelectorAll('.media-editor__toggle-button').forEach((element) => {
      ripple(element as HTMLElement);
    });
  });

  createEffect(() => {
    const isTextTabActive = editorState.currentTab === 'text';
    const mode = currentMode();
    
    if (mode === 'entitycreate' && isTextTabActive && editorState.targetFile || editorState.editingEntityId && mode === 'entitycreate') {
      actions.setEntityCreationMode('selectblock');
    } else {
      actions.setEntityCreationMode(undefined);
      editorState.isOverlayOpen = false;
    }
    
    if (mode === 'editline' && isTextTabActive && editorState.targetFile) {
      editorState.isEditingParagraph = true;
    } else {
      editorState.isEditingParagraph = false;
    }
  });

  return (
    <Show 
      when={editorState.targetFile} 
      fallback={
        <>
        </>
      }
    >
      <div class="media-editor__ocr-results">
        <ModeSwitcher />
        <Show 
          when={editorState.targetFile?.status === 'done'}
          fallback={
            <div class="media-editor__ocr-placeholder">
              <Show when={editorState.targetFile?.status === 'processing'}>
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; text-align: center; min-height: 200px;">
                  <div style="font-size: 4rem; margin-bottom: 1rem; opacity: 0.7;">⏰</div>
                  <div style="color: var(--secondary-text-color); font-size: 0.9rem; font-weight: 400; line-height: 1.4;">Обрабатываем документ...</div>
                </div>
              </Show>
              <Show when={editorState.targetFile?.status === 'error'}>
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; text-align: center; min-height: 200px;">
                  <div style="font-size: 4rem; margin-bottom: 1rem; opacity: 0.7;">❌</div>
                  <div style="color: var(--secondary-text-color); font-size: 0.9rem; font-weight: 400; line-height: 1.4;">Ошибка обработки документа</div>
                </div>
              </Show>
              <Show when={editorState.targetFile?.status === 'pending'}>
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; text-align: center; min-height: 200px;">
                  <div style="font-size: 4rem; margin-bottom: 1rem; opacity: 0.7;">⏰</div>
                  <div style="color: var(--secondary-text-color); font-size: 0.9rem; font-weight: 400; line-height: 1.4;">Загружаем документ...</div>
                </div>
              </Show>
            </div>
          }
        >
          <TabContent
            currentTab={currentMode()}
            onContainer={() => {}}
            onScroll={() => {}}
            tabs={{
              full: FullTextMode,
              paragraphs: ParagraphsMode,
              editline: () => <EditLineTab
                selectedLine={editorState.selectedBlock}
                onBack={() => {
                  editorState.selectedBlock = undefined;
                  editorState.isEditingParagraph = false;
                  editorState.editingBlockIndex = undefined;
                  editorState.originalLayerState = undefined;
                  setCurrentMode('paragraphs');
                }}
              />,
              entities: EntitiesListMode,
              entitycreate: EntitiesMode
            }}
          />
        </Show>
      </div>
    </Show>
  );
}
