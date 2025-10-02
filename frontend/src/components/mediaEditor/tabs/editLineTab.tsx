import {createSignal, createMemo, createEffect, Show, For} from 'solid-js';
import {useMediaEditorContext} from '../context';
import {IconTsx} from '../../iconTsx';
import ripple from '../../ripple'; ripple;
import {ScrollableYTsx} from '../../chat/topbarSearch';
import BottomButton from '../bottomButton';

interface EditLineTabProps {
  selectedLine?: {blockIndex: number} | null;
  onBack?: () => void;
}

export default function EditLineTab(props: EditLineTabProps) {
  const {editorState} = useMediaEditorContext();
  const [editedText, setEditedText] = createSignal('');
  const [originalText, setOriginalText] = createSignal('');
  const [boundingBox, setBoundingBox] = createSignal<any>(null);

  createEffect(() => {
    const selection = props.selectedLine;
    if (selection && editorState.targetFile) {
      const file = editorState.targetFile;
      if (file.result?.result?.textAnnotation?.blocks) {
        const block = file.result.result.textAnnotation.blocks[selection.blockIndex];
        if (block) {
          // Собираем весь текст блока
          const text = block.lines?.map((line: any) => {
            return line.words?.map((word: any) => word.text || '').join(' ') || '';
          }).join('\n') || '';
          setOriginalText(text);
          setEditedText(text);
          setBoundingBox(block.boundingBox);
        }
      }
    }
  });

  // Вычисляем координаты из boundingBox
  const coordinates = createMemo(() => {
    const box = boundingBox();
    if (!box || !box.vertices || box.vertices.length < 4) {
      return null;
    }

    const vertices = box.vertices;
    const xCoords = vertices.map((v: any) => parseInt(v.x) || 0);
    const yCoords = vertices.map((v: any) => parseInt(v.y) || 0);

    return {
      left: Math.min(...xCoords),
      top: Math.min(...yCoords),
      right: Math.max(...xCoords),
      bottom: Math.max(...yCoords),
      width: Math.max(...xCoords) - Math.min(...xCoords),
      height: Math.max(...yCoords) - Math.min(...yCoords)
    };
  });


  const handleSave = () => {
    const selection = props.selectedLine;
    if (!selection || !editorState.targetFile) return;

    const file = editorState.targetFile;
    if (!file.result?.result?.textAnnotation?.blocks) return;

    const block = file.result.result.textAnnotation.blocks[selection.blockIndex];
    if (!block || !block.lines) return;

    const newLines = editedText().split('\n').filter(line => line.trim().length > 0);
    
    block.lines.forEach((line: any, index: number) => {
      if (index < newLines.length) {
        const newText = newLines[index];
        line.text = newText;
        if (line.words && line.words.length > 0) {
          line.words[0] = {
            ...line.words[0],
            text: newText
          };
          line.words.length = 1;
        }
      }
    });
    
    if (newLines.length > block.lines.length) {
      for (let i = block.lines.length; i < newLines.length; i++) {
        const newText = newLines[i];
        block.lines.push({
          text: newText,
          words: [{
            text: newText,
            boundingBox: {vertices: []}
          }],
          boundingBox: {vertices: []},
          textSegments: []
        });
      }
    }
    
    if (newLines.length < block.lines.length) {
      block.lines.length = newLines.length;
    }
    
    if (props.onBack) {
      props.onBack();
    }
  };

  const handleCancel = () => {
    if (props.onBack) {
      props.onBack();
    }
  };

  return (
    <div class="media-editor__edit-line-tab">
      <Show
        when={props.selectedLine && editorState.targetFile?.status === 'done'}
        fallback={
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; text-align: center; min-height: 200px;">
            <div style="font-size: 4rem; margin-bottom: 1rem; opacity: 0.7;">📁</div>
            <div style="color: var(--secondary-text-color); font-size: 0.9rem; font-weight: 400; line-height: 1.4;">Выберите параграф для редактирования</div>
          </div>
        }
      >
        <>
          <ScrollableYTsx>
            <div class="media-editor__edit-line-content">
              <div class="media-editor__edit-line-editor">
                <div class="media-editor__edit-line-editor-header">
                  <button
                    class="media-editor__edit-line-back-btn"
                    onClick={handleCancel}
                    use:ripple
                    title="Назад"
                  >
                    <IconTsx icon="left" />
                  </button>
                  <div class="media-editor__edit-line-editor-title">
                    Редактировать параграф
                  </div>
                </div>

                <div class="media-editor__edit-line-editor-body">
                  <textarea
                    class="media-editor__edit-line-editor-textarea"
                    value={editedText()}
                    onInput={(e) => setEditedText(e.currentTarget.value)}
                    placeholder="Введите текст параграфа"
                    rows={10}
                  />
                  <Show when={coordinates()}>
                    <div class="media-editor__edit-line-coordinates">
                      <div class="media-editor__edit-line-coordinates-grid">
                        <div class="media-editor__edit-line-coordinate-item">
                          <span class="label">X:</span>
                          <span class="value">{coordinates()!.left}</span>
                        </div>
                        <div class="media-editor__edit-line-coordinate-item">
                          <span class="label">Y:</span>
                          <span class="value">{coordinates()!.top}</span>
                        </div>
                        <div class="media-editor__edit-line-coordinate-item">
                          <span class="label">Ширина:</span>
                          <span class="value">{coordinates()!.width}px</span>
                        </div>
                        <div class="media-editor__edit-line-coordinate-item">
                          <span class="label">Высота:</span>
                          <span class="value">{coordinates()!.height}px</span>
                        </div>
                      </div>
                    </div>
                  </Show>
                </div>
              </div>
            </div>
          </ScrollableYTsx>
          
          <BottomButton
            onClick={handleSave}
            style="bottom: 120px"
          >
            Сохранить
          </BottomButton>
        </>
      </Show>
    </div>
  );
}

