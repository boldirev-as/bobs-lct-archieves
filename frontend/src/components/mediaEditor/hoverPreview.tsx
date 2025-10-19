import {createSignal, Show, createMemo, createEffect} from 'solid-js';
import {useMediaEditorContext} from './context';
import {useParagraphThumbnails} from './useParagraphThumbnails';

interface HoverPreviewProps {
  visible: boolean;
  x: number;
  y: number;
  content?: {
    type: 'paragraph' | 'image';
    text?: string;
    imageSrc?: string;
    boundingBox?: any;
    blockIndex?: number;
  };
}

export default function HoverPreview(props: HoverPreviewProps) {
  const {editorState} = useMediaEditorContext();
  const paragraphThumbnails = useParagraphThumbnails();
  const [thumbnail, setThumbnail] = createSignal<string | null>(null);

  console.log('HoverPreview render:', {
    visible: props.visible,
    x: props.x,
    y: props.y,
    content: props.content
  });

  // Load thumbnail when content changes or file changes
  createEffect(async () => {
    const content = props.content;
    const currentFile = editorState.targetFile;
    
    if (content?.type === 'paragraph' && content?.blockIndex !== undefined) {
      console.log('Loading thumbnail for block:', content.blockIndex, 'in file:', currentFile?.id);
      
      // Проверяем, не загружаем ли мы уже миниатюру для того же блока
      const currentThumbnail = thumbnail();
      if (currentThumbnail) {
        console.log('Thumbnail already loaded, skipping');
        return;
      }
      
      const thumb = await paragraphThumbnails.getThumbnail(content.blockIndex);
      setThumbnail(thumb);
      console.log('Thumbnail loaded:', thumb ? 'YES' : 'NO', 'for file:', currentFile?.id);
    } else {
      setThumbnail(null);
    }
  });

  // Clear thumbnail when file changes
  createEffect(() => {
    const currentFile = editorState.targetFile;
    if (currentFile) {
      console.log('File changed, clearing thumbnail cache');
      setThumbnail(null);
    }
  });

  const previewStyle = createMemo(() => {
    const baseStyle = {
      position: 'absolute' as const,
      right: '0',
      top: '0',
      'z-index': 100000000000000,
      width: '100%',
      height: '100%',
      'backdrop-filter': 'blur(10px)',
      '-webkit-backdrop-filter': 'blur(10px)',
      padding: '12px',
      maxWidth: '300px',
      pointerEvents: 'none' as const,
    };
    
    return {
      ...baseStyle,
      opacity: props.visible ? 1 : 0,
    };
  });

  return (
    <>
      <Show when={props.visible && props.content}>
        <div style={previewStyle()}>
        <Show when={props.content?.type === 'paragraph'}>
          <div style="margin-bottom: 8px;">
            <div style="font-size: 12px; color: var(--secondary-text-color); margin-bottom: 4px;">
              Абзац
            </div>
            
            {/* Show thumbnail if available */}
            <Show when={thumbnail()}>
              <div style="margin-bottom: 8px; width: 100%; min-height: 200px; height: max-content; display: flex; justify-content: center; align-items: center;">
                <img 
                  src={thumbnail()!} 
                  alt="Превью абзаца"
                  style="
                    width: 100%;
                    max-width: max-content;
                    min-height: 200px;
                    height: auto;
                    border-radius: 4px;
                    background: #f0f0f0;
                    object-fit: contain;
                  "
                />
              </div>
            </Show>
            
            <div style="font-size: 14px; line-height: 1.4;">
              {props.content?.text || 'Нет текста'}
            </div>
          </div>
        </Show>
        
        <Show when={props.content?.type === 'image'}>
          <div style="margin-bottom: 8px;">
            <div style="font-size: 12px; color: var(--secondary-text-color); margin-bottom: 4px;">
              Изображение
            </div>
            <Show when={props.content?.imageSrc}>
              <img 
                src={props.content?.imageSrc} 
                alt="Превью"
                style="max-width: 100%; max-height: 150px; border-radius: 4px;"
              />
            </Show>
          </div>
        </Show>
        
        <Show when={props.content?.boundingBox}>
          <div style="font-size: 11px; color: var(--secondary-text-color); margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border-color);">
            <div>X: {props.content?.boundingBox?.vertices?.[0]?.x || 'N/A'}</div>
            <div>Y: {props.content?.boundingBox?.vertices?.[0]?.y || 'N/A'}</div>
          </div>
        </Show>
        </div>
      </Show>
    </>
  );
}
