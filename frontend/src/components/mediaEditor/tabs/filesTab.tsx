import {createSignal, For, Show} from 'solid-js';
import {ButtonIconTsx} from '../../buttonIconTsx';
import {useMediaEditorContext} from '../context';
import {UploadedFile} from '../types';
import './filesTab.scss';

function FileStatusIcon(props: {status: UploadedFile['status']}) {
  switch (props.status) {
    case 'pending':
      return <div class="file-status-icon file-status-icon--pending">⏳</div>;
    case 'processing':
      return <div class="file-status-icon file-status-icon--processing">🔄</div>;
    case 'done':
      return <div class="file-status-icon file-status-icon--done">✅</div>;
    case 'error':
      return <div class="file-status-icon file-status-icon--error">❌</div>;
    default:
      return <div class="file-status-icon">❓</div>;
  }
}

function FileItem(props: {file: UploadedFile}) {
  const {actions} = useMediaEditorContext();
  const [isExpanded, setIsExpanded] = createSignal(false);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: Date) => {
    return date.toLocaleString();
  };

  return (
    <div class="file-item">
      <div class="file-item__header" onClick={() => setIsExpanded(!isExpanded())}>
        <div class="file-item__info">
          <FileStatusIcon status={props.file.status} />
          <div class="file-item__details">
            <div class="file-item__name">{props.file.filename}</div>
            <div class="file-item__meta">
              {formatFileSize(props.file.size)} • {formatDate(props.file.uploadedAt)}
            </div>
          </div>
        </div>
        <div class="file-item__actions">
          <Show when={props.file.status === 'error'}>
            <ButtonIconTsx
              icon="rotate"
              onClick={(e) => {
                e.stopPropagation();
                actions.retryFileUpload(props.file.id);
              }}
            />
          </Show>
          <ButtonIconTsx
            icon="delete"
            onClick={(e) => {
              e.stopPropagation();
              actions.deleteFile(props.file.id);
            }}
          />
          <ButtonIconTsx
            icon={isExpanded() ? "collapse" : "expand"}
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded());
            }}
          />
        </div>
      </div>
      
      <Show when={isExpanded()}>
        <div class="file-item__content">
          <Show when={props.file.error}>
            <div class="file-item__error">
              <strong>Error:</strong> {props.file.error}
            </div>
          </Show>
          
          <Show when={props.file.filepath}>
            <div class="file-item__filepath">
              <strong>File path:</strong> {props.file.filepath}
            </div>
          </Show>
          
          <Show when={props.file.result?.result?.textAnnotation}>
            <div class="file-item__ocr-result">
              <strong>OCR Result:</strong>
              <div class="file-item__ocr-text">
                {props.file.result.result.textAnnotation.fullText}
              </div>
              <Show when={props.file.result.result.textAnnotation.markdown}>
                <div class="file-item__markdown">
                  <strong>Markdown:</strong>
                  <pre class="file-item__markdown-content">
                    {props.file.result.result.textAnnotation.markdown}
                  </pre>
                </div>
              </Show>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

export default function FilesTab() {
  const {mediaState, editorState, actions} = useMediaEditorContext();
  const [isDragOver, setIsDragOver] = createSignal(false);
  const [isUploadingFolder, setIsUploadingFolder] = createSignal(false);
  let fileInputRef: HTMLInputElement;

  const handleFileSelect = async (files: FileList) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
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
    setIsDragOver(false);
    
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
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  return (
    <div class="files-tab">
      <div class="files-tab__header">
        <h3>File Upload & OCR</h3>
        <p>Upload documents for text recognition</p>
        <Show when={editorState.galleryItems.length > 0}>
          <button 
            class="files-tab__gallery-button"
            onClick={() => actions.toggleGallery()}
          >
            📷 View Gallery ({editorState.galleryItems.length})
          </button>
        </Show>
      </div>

      <div
        class="files-tab__upload-area"
        classList={{
          'files-tab__upload-area--drag-over': isDragOver()
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.click()}
      >
        <div class="files-tab__upload-content">
          <div class="files-tab__upload-icon">📁</div>
          <div class="files-tab__upload-text">
            <strong>Click to upload</strong> or drag and drop files here
          </div>
          <div class="files-tab__upload-hint">
            Supports images (JPG, PNG, GIF, etc.) and PDF files
          </div>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          style="display: none"
          {...({webkitdirectory: ""} as any)}
          onChange={(e) => {
            if (e.target.files) {
              // Проверяем, выбрана ли папка (webkitdirectory)
              const isDirectory = e.target.hasAttribute('webkitdirectory');
              if (isDirectory) {
                handleFolderSelect(e.target.files);
              } else {
                handleFileSelect(e.target.files);
              }
            }
          }}
        />
      </div>

      <div class="files-tab__files-list">
        <Show when={mediaState.uploadedFiles.length === 0}>
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; text-align: center; min-height: 200px;">
            <div style="font-size: 4rem; margin-bottom: 1rem; opacity: 0.7;">📁</div>
            <div style="color: var(--secondary-text-color); font-size: 0.9rem; font-weight: 400; line-height: 1.4;">Файлы не загружены</div>
          </div>
        </Show>
        
        <For each={mediaState.uploadedFiles}>
          {(file) => <FileItem file={file} />}
        </For>
      </div>
    </div>
  );
}
