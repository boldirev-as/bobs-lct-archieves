import {createSignal, For, Show, createMemo} from 'solid-js';
import {useMediaEditorContext} from './context';

export default function EntitySelectionOverlay() {
  const {editorState, mediaState, actions} = useMediaEditorContext();
  
  // State for selected blocks (checkboxes)
  const [selectedBlocks, setSelectedBlocks] = createSignal<Record<number, boolean>>({});
  
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
    
    // TODO: Notify parent component about selected blocks
    console.log('Block selection changed:', blockIndex, selected);
  };

  return (
    <div class="media-editor__entity-selection-overlay">
      <div class="media-editor__overlay-header">
        <h3>Выберите блоки для создания образов</h3>
        <p>Отметьте нужные блоки текста. Настройка диапазона символов будет доступна в панели инструментов.</p>
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
              
              return (
                <div 
                  class="media-editor__entity-block"
                  classList={{
                    'media-editor__entity-block--selected': selectedBlocks()[blockIndex]
                  }}
                >
                  <div class="media-editor__entity-text-preview">
                    {paragraph.text}
                  </div>
                </div>
              );
            }}
          </For>
        </Show>
      </div>
    </div>
  );
}