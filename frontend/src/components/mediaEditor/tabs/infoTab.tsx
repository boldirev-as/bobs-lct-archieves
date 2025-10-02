import {createSignal, createEffect, createMemo} from 'solid-js';
import {InputFieldTsx} from '../../inputFieldTsx';
import {useMediaEditorContext} from '../context';
import {IconTsx} from '../../iconTsx';
import ripple from '../../ripple'; ripple

export default function InfoTab() {
  const {editorState} = useMediaEditorContext();
  const [title, setTitle] = createSignal('');
  const [number, setNumber] = createSignal('');
  const [documentType, setDocumentType] = createSignal<'архив' | 'форма' | 'опись' | 'дело' | 'не известно'>('архив');

  // Синхронизируем поля с данными текущего файла
  createEffect(() => {
    const file = editorState.targetFile;
    if (file) {
      if (file.filename) {
        setTitle(file.filename);
      }
      if (file.result?.result?.pageNumber) {
        setNumber(file.result.result.pageNumber);
      }
      if (file.result?.result?.type) {
        setDocumentType(file.result.result.type);
      }
    }
  });

  const documentTypes: Array<{value: 'архив' | 'форма' | 'опись' | 'дело' | 'не известно', label: string}> = [
    {value: 'архив', label: 'Архив'},
    {value: 'форма', label: 'Форма'},
    {value: 'опись', label: 'Опись'},
    {value: 'дело', label: 'Дело'},
    {value: 'не известно', label: 'Не известно'}
  ];

  // Статистика файла
  const fileStats = createMemo(() => {
    const file = editorState.targetFile;
    if (!file) return null;

    const ocrBlocks = file.result?.result?.textAnnotation?.blocks || [];
    const entities = file.entities || file.result?.result?.textAnnotation?.entities || [];
    const totalText = ocrBlocks.reduce((acc, block) => {
      return acc + (block.lines?.map(line => line.text).join(' ') || '');
    }, '');

    return {
      filename: file.filename || 'Без названия',
      fileSize: file.size ? `${(file.size / 1024).toFixed(1)} КБ` : 'Неизвестно',
      uploadDate: file.uploadedAt ? new Date(file.uploadedAt).toLocaleDateString('ru-RU') : 'Неизвестно',
      status: file.status || 'pending',
      blocksCount: ocrBlocks.length,
      entitiesCount: entities.length,
      charactersCount: totalText.length,
      wordsCount: totalText.split(/\s+/).filter(word => word.length > 0).length
    };
  });

  return (
    <div class="media-editor__info-tab" style={'margin-top: 12px;'}>
      <InputFieldTsx
        label={ "Введите название документа" as any }
        placeholder={ "Введите название" as any }
        value={title()}
        instanceRef={(input) => {
          input.input.addEventListener('input', () => {
            const newValue = input.value;
            setTitle(newValue);
            
            // Обновляем filename в targetFile
            const file = editorState.targetFile;
            if (file) {
              file.filename = newValue;
            }
          });
        }}
      />

      <div class="media-editor__file-stats">        
        <div class="media-editor__stats-grid">
          <div class="media-editor__stat-item">
            <IconTsx icon="data" />
            <div class="media-editor__stat-content">
              <span class="media-editor__stat-label">Размер файла</span>
              <span class="media-editor__stat-value">{fileStats()?.fileSize}</span>
            </div>
          </div>
          
          <div class="media-editor__stat-item">
            <IconTsx icon="calendar" />
            <div class="media-editor__stat-content">
              <span class="media-editor__stat-label">Дата загрузки</span>
              <span class="media-editor__stat-value">{fileStats()?.uploadDate}</span>
            </div>
          </div>
          
          <div class="media-editor__stat-item">
            <IconTsx icon="text" />
            <div class="media-editor__stat-content">
              <span class="media-editor__stat-label">Абзацев</span>
              <span class="media-editor__stat-value">{fileStats()?.blocksCount}</span>
            </div>
          </div>
          
          <div class="media-editor__stat-item">
            <IconTsx icon="user" />
            <div class="media-editor__stat-content">
              <span class="media-editor__stat-label">Образов</span>
              <span class="media-editor__stat-value">{fileStats()?.entitiesCount}</span>
            </div>
          </div>
          
          <div class="media-editor__stat-item">
            <IconTsx icon="edit" />
            <div class="media-editor__stat-content">
              <span class="media-editor__stat-label">Символов</span>
              <span class="media-editor__stat-value">{fileStats()?.charactersCount}</span>
            </div>
          </div>
          
          <div class="media-editor__stat-item">
            <IconTsx icon="menu" />
            <div class="media-editor__stat-content">
              <span class="media-editor__stat-label">Слов</span>
              <span class="media-editor__stat-value">{fileStats()?.wordsCount}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
