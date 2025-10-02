import {For, Show} from 'solid-js';
import {useMediaEditorContext} from './context';
import ripple from '../ripple'; ripple

interface BlockSelectionOverlayProps {
  fileId: string;
  fileIndex: number;
}

export default function BlockSelectionOverlay(props: BlockSelectionOverlayProps) {
  const {mediaState, editorState, actions} = useMediaEditorContext();
  
  const currentFile = () => mediaState.uploadedFiles.find(f => f.id === props.fileId);
  const textBlocks = () => currentFile()?.result?.result?.textAnnotation?.blocks || [];
  
  const handleBlockSelect = (blockIndex: number) => {
    actions.setSelectedBlock({blockIndex});
  };

  return (
    <Show when={editorState.entityCreationMode === 'selectblock'}>
      <div class="block-selection-overlay">
        <div class="block-selection-overlay__header">
          <h3>Выберите блок текста для создания образа</h3>
        </div>
        
        <div class="block-selection-overlay__blocks">
          <For each={textBlocks()}>
            {(block, index) => (
              <label
                class="media-editor__radio-item block-selection-item rp"
                use:ripple
                onClick={() => handleBlockSelect(index())}
              >
                <input
                  type="radio"
                  name="block-selection"
                  checked={ editorState.selectedBlock?.blockIndex === index() }
                />
                <div class="media-editor__radio-content">
                  <div class="media-editor__radio-circle">
                    <div class="media-editor__radio-inner"></div>
                  </div>
                  <span class="media-editor__radio-text">
                    {block.lines?.map(line => line.words?.map(word => word.text).join(' ')).join(' ') || 'Пустой блок'}
                  </span>
                </div>
              </label>
            )}
          </For>
        </div>
      </div>
    </Show>
  );
}