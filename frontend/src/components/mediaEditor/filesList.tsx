import {For, Show} from 'solid-js';
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
  let fileInput: HTMLInputElement;
  const handleFileSelect = async (files: FileList) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) {
        continue;
      }

      try {
        await actions.uploadFile(file);
      } catch (error) {
        console.error('Failed to upload file:', error);
      }
    }
  };

  const handleFileInputChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      handleFileSelect(target.files);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    
    if (e.dataTransfer?.files) {
      handleFileSelect(e.dataTransfer.files);
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

      <BottomButton
        icon="dragfiles"
        onClick={() => fileInput.click()}
      >
        Загрузить файл
      </BottomButton>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        style="display: none"
        onChange={handleFileInputChange}
      />
    </div>
  );
}
