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
    
    // Extract text from blocks
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

  // Extract images/visual elements (placeholder for now)
  const ocrImages = createMemo((): any[] => {
    // В будущем здесь можно будет извлекать информацию о найденных изображениях/элементах
    return [];
  });

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
      // Выбираем блок для редактирования
      editorState.selectedBlock = {blockIndex};
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
                {ocrParagraphs().map((paragraph, index) => (
                  <div
                    class="media-editor__ocr-paragraph-wrapper"
                  >
                    <div onClick={() => handleParagraphClick(paragraph.id)} use:ripple class="media-editor__ocr-paragraph">
                      <div class="media-editor__ocr-paragraph-text">
                        {paragraph.text}
                      </div>
                    </div>
                  </div>
                ))}
              </Show>
            </div>
          </div>
        </ScrollableYTsx>
        
        <BottomButton
          icon="plus"
          onClick={() => {
            // TODO: Добавить функциональность добавления абзаца
            console.log('Добавить абзац');
          }}
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
      // TODO: Handle entity click - maybe edit or view details
      console.log('Entity clicked:', entity);
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
    
    // Initialize slider values when block is selected
    createEffect(() => {
      const block = selectedBlock();
      if (block) {
        const charCount = getBlockCharCount();
        setSliderValues({start: 0, end: charCount});
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
    
    // Create entity from selected text
    const handleCreateEntity = () => {
      const block = selectedBlock();
      const selected = editorState.selectedBlock;
      
      if (block && selected) {
        const {start, end} = sliderValues();
        const selectedText = block.text.substring(start, end);
        
        if (selectedText.trim()) {
          // Create entity using context action
          const entityId = actions.createEntity(
            selected.blockIndex,
            selectedText,
            start,
            end,
            selectedEntityType()
          );
          
          console.log('Created entity with ID:', entityId);
          
          // Reset state and go back to entities mode
          actions.setSelectedBlock(undefined);
          actions.setEntityCreationMode(undefined);
          setSliderValues({start: 0, end: 0});
          setCurrentMode('entities');
        }
      }
    };

    onCleanup(() => {
      actions.setSelectedBlock(undefined);
      actions.setEntityCreationMode(undefined);
    });
    
    return (
      <>
        <ScrollableYTsx>
          <div class="media-editor__ocr-content">
            <div style="position: sticky; left: 0; top: -8px; background-color: #212121; z-index: 10" class="media-editor__edit-line-editor-header">
              <button
                class="media-editor__edit-line-back-btn"
                onClick={() => {
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
              <div style="margin-left: 8px" class="media-editor__edit-line-editor-title">
                Создание образа
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
          Создать образ
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
