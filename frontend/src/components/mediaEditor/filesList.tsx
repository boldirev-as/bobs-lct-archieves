import {createSignal, For, Show} from 'solid-js';
import {modifyMutable, produce} from 'solid-js/store';
import {useMediaEditorContext} from './context';
import {IconTsx} from '../iconTsx';
import ripple from '../ripple'; ripple;
import {ScrollableYTsx} from '../chat/topbarSearch';
import ArchiveFileItem from './archiveFileItem';
import BottomButton from './bottomButton';

// Utility function to get the correct image source with fallback logic
function getImageSrcWithFallback(filepath: string): { localSrc: string; apiSrc: string } {
  // If it's already a blob URL, use it directly
  if (filepath.startsWith('blob:')) {
    return { localSrc: filepath, apiSrc: filepath };
  }
  
  // Clean up the filepath to avoid double slashes
  const cleanFilepath = filepath.startsWith('/') ? filepath.slice(1) : filepath;
  
  // Local path (assuming files are served from a local directory)
  const localSrc = `/${cleanFilepath}`;
  
  // API path with proper slash handling
  const apiSrc = `/s3/${cleanFilepath}`;
  
  return { localSrc, apiSrc };
}

export default function FilesList() {
  const {mediaState, actions, editorState} = useMediaEditorContext();
  const [isUploadingFolder, setIsUploadingFolder] = createSignal(false);
  let fileInput: HTMLInputElement;
  let folderInput: HTMLInputElement;
  const handleFileSelect = async (files: FileList) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        continue;
      }

      try {
        await actions.uploadFile(file);
      } catch (error) {
        console.error('Failed to upload file:', error);
      }
    }
  };


  const handleFolderSelect = async (files: FileList) => {
    setIsUploadingFolder(true);
    let uploadedCount = 0;
    let totalFiles = 0;
    
    // Подсчитываем общее количество файлов
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        totalFiles++;
      }
    }
    
    console.log(`Найдено ${totalFiles} изображений и PDF файлов в папке`);
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Фильтруем только изображения и PDF
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        continue;
      }
      
      try {
        await actions.uploadFile(file);
        uploadedCount++;
        console.log(`Загружено ${uploadedCount}/${totalFiles}: ${file.name}`);
      } catch (error) {
        console.error(`Failed to upload file ${file.name}:`, error);
      }
    }
    
    setIsUploadingFolder(false);
    console.log(`Загрузка папки завершена. Загружено ${uploadedCount} из ${totalFiles} файлов`);
  };


  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    
    if (e.dataTransfer?.files) {
      // Проверяем, содержит ли drop папку (webkitdirectory)
      const hasDirectory = Array.from(e.dataTransfer.files).some(file => 
        file.webkitRelativePath && file.webkitRelativePath.includes('/')
      );
      
      if (hasDirectory) {
        handleFolderSelect(e.dataTransfer.files);
      } else {
        handleFileSelect(e.dataTransfer.files);
      }
    }
  };


  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
  };

  const removeFile = (fileId: string) => {
    actions.deleteFile(fileId);
  };

  const retryUpload = (fileId: string) => {
    actions.retryFileUpload(fileId);
  };

  const selectFile = (file: any) => {
    console.log('FilesList: Selecting file:', file);
    // Use the action to set targetFile for consistency
    actions.setTargetFile(file);
  };

  // Вычисляем статистику файлов
  const totalFiles = () => mediaState.uploadedFiles.length;
  const processedFiles = () => mediaState.uploadedFiles.filter(file => file.status === 'done').length;
  const processingFiles = () => mediaState.uploadedFiles.filter(file => file.status === 'processing').length;
  const errorFiles = () => mediaState.uploadedFiles.filter(file => file.status === 'error').length;

  return (
    <div class="files-list">
      <div class="files-list__header">
        <h3 class="files-list__title">Архив рукописей</h3>
      </div>

      <Show
        when={mediaState.uploadedFiles.length > 0}
        fallback={
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; text-align: center; min-height: 200px;">
            <div style="font-size: 4rem; margin-bottom: 1rem; opacity: 0.7;">📁</div>
            <div style="color: var(--secondary-text-color); font-size: 0.9rem; font-weight: 400; line-height: 1.4;">Файлы не загружены</div>
          </div>
        }
      >
        <ScrollableYTsx class="files-list__items media-editor__tab-content-scrollable-content">
          <Show when={mediaState.uploadedFiles.length > 0}>
            <div class="files-list__stats">
              <div class="files-list__stats-main">
                <span class="files-list__stats-total">Всего файлов: {totalFiles()}</span>
              </div>
              <div class="files-list__stats-details">
                <div class="files-list__stats-item files-list__stats-item--success">
                  <div class="files-list__stats-dot files-list__stats-dot--success"></div>
                  <span>Обработано: {processedFiles()}</span>
                </div>
                <Show when={processingFiles() > 0}>
                  <div class="files-list__stats-item files-list__stats-item--processing">
                    <div class="files-list__stats-dot files-list__stats-dot--processing"></div>
                    <span>Обрабатывается: {processingFiles()}</span>
                  </div>
                </Show>
                <Show when={errorFiles() > 0}>
                  <div class="files-list__stats-item files-list__stats-item--error">
                    <div class="files-list__stats-dot files-list__stats-dot--error"></div>
                    <span>Ошибки: {errorFiles()}</span>
                  </div>
                </Show>
              </div>
            </div>
          </Show>
          <For each={mediaState.uploadedFiles.filter(file => file.type.startsWith('image/'))}>
            {(file) => (
              <div 
                class="files-list__item" 
                classList={{
                  'files-list__item--clickable': file.status === 'done',
                  'files-list__item--selected': editorState.targetFile?.id === file.id
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  selectFile(file);
                }}
                use:ripple
              >
                <div class="files-list__item-avatar files-list__item-avatar--image">
                  <Show 
                    when={file.filepath}
                    fallback={<IconTsx icon="image" />}
                  >
                    <img 
                      src={(() => {
                        // If it's a blob URL or full URL, use directly
                        if (file.filepath.startsWith('blob:') || file.filepath.startsWith('http')) {
                          return file.filepath;
                        }
                        // Otherwise use local path first
                        const { localSrc } = getImageSrcWithFallback(file.filepath);
                        return localSrc;
                      })()} 
                      alt={file.filename}
                      class="files-list__item-avatar-image"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        const currentSrc = target.src;
                        
                        // If local path failed, try API path
                        if (!file.filepath.startsWith('blob:') && !file.filepath.startsWith('http')) {
                          const { localSrc, apiSrc } = getImageSrcWithFallback(file.filepath);
                          if (currentSrc === localSrc) {
                            target.src = apiSrc;
                            return;
                          }
                        }
                        
                        // If both failed, show icon
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          const icon = document.createElement('span');
                          icon.className = 'tgico-image';
                          parent.appendChild(icon);
                        }
                      }}
                    />
                  </Show>
                </div>
                <div class="files-list__item-info">
                  <div class="files-list__item-name" title={file.filename}>
                    {file.filename}
                  </div>
                  <div class="files-list__item-details">
                    <span class={`files-list__item-status files-list__item-status--${file.status}`}>
                      {file.status === 'pending' ? 'Загрузка...' :
                       file.status === 'processing' ? 'Обработка...' :
                       file.status === 'done' ? 'Готово' :
                       file.status === 'error' ? 'Ошибка' : file.status}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </For>
        </ScrollableYTsx>
      </Show>

      <div>
        <div
          style={{
            height: '75px',
            position: 'absolute',
            left: '0',
            right: '0',
            bottom: '70px',
            color: 'white',
            padding: '12px 16px 0 12px',
            width: '100%',
            transition: 'all 0.2s ease',
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'center',
            "backdrop-filter": "blur(10px)",
            "-webkit-backdrop-filter": "blur(10px)",
          }}
        >
          <button
            onClick={() => folderInput.click()}
            disabled={isUploadingFolder()}
            class="bottom-button"
            style={{
              color: 'white',
              border: 'none',
              cursor: isUploadingFolder() ? 'not-allowed' : 'pointer',
              opacity: isUploadingFolder() ? 0.6 : 1,
              transition: 'all 0.2s ease',
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              'z-index': 10,
              'width': '100%',
              'min-width': '376px',
            }}
          >
            📁 {isUploadingFolder() ? '⏳ Загрузка...' : 'Загрузить папку'}
          </button>
        </div>

        <BottomButton
          icon="dragfiles"
          onClick={() => fileInput.click()}
        >
          Загрузить файлы
        </BottomButton>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/*,application/pdf"
        multiple
        style="display: none"
        onChange={(e) => {
          const target = e.target as HTMLInputElement;
          if (target.files && target.files.length > 0) {
            handleFileSelect(target.files);
          }
        }}
      />
      
      <input
        ref={folderInput}
        type="file"
        {...({webkitdirectory: ""} as any)}
        {...({directory: ""} as any)}
        multiple
        accept="image/*,application/pdf"
        style="display: none"
        onChange={(e) => {
          const target = e.target as HTMLInputElement;
          if (target.files && target.files.length > 0) {
            handleFolderSelect(target.files);
          }
        }}
      />
    </div>
  );
}
