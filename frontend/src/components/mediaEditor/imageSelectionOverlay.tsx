import {createSignal, For, Show, createMemo} from 'solid-js';
import {useMediaEditorContext} from './context';
import RangeInput from './rangeInput';

export default function ImageSelectionOverlay() {
  const {editorState, mediaState, actions} = useMediaEditorContext();
  
  // State for selected blocks (checkboxes)
  const [selectedBlocks, setSelectedBlocks] = createSignal<Record<number, boolean>>({});
  
  // State for double slider values for each block (start and end)
  const [sliderValues, setSliderValues] = createSignal<Record<number, {start: number, end: number}>>({});
  
  const currentFile = () => editorState.targetFile;
  
  // Extract paragraphs (blocks) from OCR data
  const ocrParagraphs = createMemo(() => {
    if (!currentFile()?.result?.result?.textAnnotation?.blocks) {
      return [];
    }

    return currentFile()!.result!.result!.textAnnotation!.blocks.map((block: any, index: number) => {
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
  
  // Handle block selection
  const handleBlockSelection = (blockIndex: number, selected: boolean) => {
    setSelectedBlocks(prev => ({
      ...prev,
      [blockIndex]: selected
    }));
  };
  
  // Handle slider change for start position
  const handleStartSliderChange = (blockIndex: number, value: number) => {
    setSliderValues(prev => {
      const current = prev[blockIndex] || {start: 0, end: 0};
      return {
        ...prev,
        [blockIndex]: {
          ...current,
          start: Math.min(value, current.end) // Ensure start <= end
        }
      };
    });
  };
  
  // Handle slider change for end position
  const handleEndSliderChange = (blockIndex: number, value: number) => {
    setSliderValues(prev => {
      const current = prev[blockIndex] || {start: 0, end: 0};
      return {
        ...prev,
        [blockIndex]: {
          ...current,
          end: Math.max(value, current.start) // Ensure end >= start
        }
      };
    });
  };
  
  // Get character count for a block
  const getBlockCharCount = (block: any) => {
    return block.text?.length || 0;
  };
  
  // Get highlighted text for a block based on slider values
  const getHighlightedText = (block: any, blockIndex: number) => {
    const text = block.text || '';
    const values = sliderValues()[blockIndex] || {start: 0, end: 0};
    
    const beforePart = text.substring(0, values.start);
    const highlightedPart = text.substring(values.start, values.end);
    const afterPart = text.substring(values.end);
    
    return (
      <>
        <span>{beforePart}</span>
        <span class="media-editor__entity-highlighted" style="text-decoration: underline; background-color: rgba(255, 255, 0, 0.3);">
          {highlightedPart}
        </span>
        <span>{afterPart}</span>
      </>
    );
  };
  
  // Create entity from selected text
  const handleCreateEntity = () => {
    const selected = selectedBlocks();
    const values = sliderValues();
    
    Object.keys(selected).forEach(blockIndexStr => {
      const blockIndex = parseInt(blockIndexStr);
      if (selected[blockIndex] && values[blockIndex]) {
        const block = ocrParagraphs()[blockIndex];
        const {start, end} = values[blockIndex];
        const selectedText = block.text.substring(start, end);
        
        if (selectedText.trim()) {
          // TODO: Save entity to the file's entities array
          console.log('Creating entity:', {
            blockIndex,
            text: selectedText,
            startIndex: start,
            endIndex: end
          });
        }
      }
    });
  };

  return (
    <div class="media-editor__image-selection-overlay">
      <div class="media-editor__overlay-header">
        <h3>Создание образов</h3>
        <p>Выберите блоки и укажите диапазон символов для создания образов</p>
      </div>
      
      <div class="media-editor__overlay-content">
        <Show
          when={ocrParagraphs().length > 0}
          fallback={
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; text-align: center; min-height: 200px;">
              <div style="font-size: 4rem; margin-bottom: 1rem; opacity: 0.7;">📁</div>
              <div style="color: var(--secondary-text-color); font-size: 0.9rem; font-weight: 400; line-height: 1.4;">Блоки текста не найдены</div>
            </div>
          }
        >
          <For each={ocrParagraphs()}>
            {(paragraph, index) => {
              const blockIndex = index();
              const charCount = getBlockCharCount(paragraph);
              const values = sliderValues()[blockIndex] || {start: 0, end: charCount};
              
              return (
                <div class="media-editor__entity-block">
                  <div class="media-editor__entity-text-preview">
                    {getHighlightedText(paragraph, blockIndex)}
                  </div>
                  
                  <div class="media-editor__entity-sliders">
                    <RangeInput
                      label="Начало выделения"
                      value={values.start}
                      min={0}
                      max={charCount}
                      onChange={(value) => handleStartSliderChange(blockIndex, value)}
                    />
                    <RangeInput
                      label="Конец выделения"
                      value={values.end}
                      min={0}
                      max={charCount}
                      onChange={(value) => handleEndSliderChange(blockIndex, value)}
                    />
                  </div>
                </div>
              );
            }}
          </For>
        </Show>
      </div>
      
      <div class="media-editor__overlay-actions">
        <button 
          class="media-editor__create-entities-btn"
          onClick={handleCreateEntity}
          disabled={Object.keys(selectedBlocks()).length === 0}
        >
          Создать образы
        </button>
      </div>
    </div>
  );
}
