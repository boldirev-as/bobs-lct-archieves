import {createSignal, createEffect} from 'solid-js';
import {useMediaEditorContext} from './context';
import {UploadedFile} from './types';
import {IconTsx} from '../iconTsx';
import ripple from '../ripple';

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

interface ArchiveFileItemProps {
  file: UploadedFile;
  onSelect: (file: UploadedFile) => void;
  isSelected: boolean;
}

export default function ArchiveFileItem(props: ArchiveFileItemProps) {
  const {mediaState, loadDocumentAsMedia} = useMediaEditorContext();

  const [localFile, setLocalFile] = createSignal(props.file);

  // Watch for changes in global state and update local file
  createEffect(() => {
    const globalFile = mediaState.uploadedFiles.find(f => 
      f.id === props.file.id || 
      (f.id.startsWith('temp_') && f.filename === props.file.filename && f.uploadedAt === props.file.uploadedAt)
    );
    
    if (globalFile) {
      setLocalFile(globalFile);
    }
  });

  const handleClick = async (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    const file = localFile();
    if (file.status === 'done') {
      console.log('ArchiveFileItem: Loading document as media:', file);
      props.onSelect(file); // Still call the original onSelect
      await loadDocumentAsMedia(file); // Load as main media
    }
  };

  const file = localFile();

  return (
    <div 
      class="files-list__item" 
      classList={{
        'files-list__item--clickable': file.status === 'done',
        'files-list__item--selected': props.isSelected
      }}
      onClick={handleClick}
      use:ripple
    >
      <div class="files-list__item-avatar files-list__item-avatar--image">
        {file.filepath ? (
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
        ) : (
          <IconTsx icon="image" />
        )}
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
  );
}