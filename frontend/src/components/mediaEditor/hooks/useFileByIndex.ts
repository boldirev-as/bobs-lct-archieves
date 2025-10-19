import {createMemo, Accessor} from 'solid-js';
import {useMediaEditorContext} from '../context';
import {UploadedFile} from '../types';

/**
 * Hook to get a file by its index in the uploadedFiles array
 * This is useful for swiper slides where each slide has a specific index
 */
export function useFileByIndex(index: Accessor<number> | number): Accessor<UploadedFile | undefined> {
  const {mediaState} = useMediaEditorContext();
  
  return createMemo(() => {
    const idx = typeof index === 'function' ? index() : index;
    return mediaState.uploadedFiles[idx];
  });
}

/**
 * Hook to get a file by its ID
 */
export function useFileById(fileId: Accessor<string | undefined> | string | undefined): Accessor<UploadedFile | undefined> {
  const {mediaState} = useMediaEditorContext();
  
  return createMemo(() => {
    const id = typeof fileId === 'function' ? fileId() : fileId;
    if (!id) return undefined;
    return mediaState.uploadedFiles.find(file => file.id === id);
  });
}

/**
 * Hook to check if a file is currently active (selected as targetFile)
 */
export function useIsFileActive(file: Accessor<UploadedFile | undefined>): Accessor<boolean> {
  const {editorState} = useMediaEditorContext();
  
  return createMemo(() => {
    const f = file();
    return f !== undefined && editorState.targetFile?.id === f.id;
  });
}

/**
 * Hook to get the index of a file in the uploadedFiles array
 */
export function useFileIndex(file: Accessor<UploadedFile | undefined>): Accessor<number> {
  const {mediaState} = useMediaEditorContext();
  
  return createMemo(() => {
    const f = file();
    if (!f) return -1;
    return mediaState.uploadedFiles.findIndex(item => item.id === f.id);
  });
}

