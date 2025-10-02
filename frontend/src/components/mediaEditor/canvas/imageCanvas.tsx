import {createEffect, createSignal, createMemo, onMount, onCleanup} from 'solid-js';
import {modifyMutable, produce} from 'solid-js/store';
import {useMediaEditorContext} from '../context';
import {getCurrentFile} from '../utils';

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
  const apiSrc = `/s3${cleanFilepath}`;
  
  return { localSrc, apiSrc };
}

interface ImageCanvasProps {
  fileId?: string;
  fileIndex?: number;
  onImageElementReady?: (img: HTMLImageElement | null) => void;
}

export default function ImageCanvas(props: ImageCanvasProps) {
  const {editorState, mediaState, mediaSrc, mediaType, actions} = useMediaEditorContext();
  
  // Get the file for this canvas (by index, by ID, or current file)
  const currentCanvasFile = createMemo(() => {
    // First try by index (most reliable for swiper)
    if (props.fileIndex !== undefined) {
      return mediaState.uploadedFiles[props.fileIndex];
    }
    
    // Then try by ID
    if (props.fileId) {
      return mediaState.uploadedFiles.find(f => f.id === props.fileId);
    }
    
    // Fallback to current file
    return getCurrentFile(editorState, mediaState);
  });
  
  const [imageSrc, setImageSrc] = createSignal<string>('');
  const [imageLoaded, setImageLoaded] = createSignal(false);
  const [containerSize, setContainerSize] = createSignal<[number, number]>([0, 0]);
  
  let imageElement: HTMLImageElement;
  let containerElement: HTMLDivElement;
  
  // Вычисляем искусственный object-fit: contain
  const imageStyle = createMemo(() => {
    const file = currentCanvasFile();
    if (!file?.imageDimensions || !imageLoaded()) {
      return {
        width: '100%',
        height: '100%',
        position: 'absolute' as const,
        top: '0',
        left: '0'
      };
    }
    
    const [containerWidth, containerHeight] = containerSize();
    if (containerWidth === 0 || containerHeight === 0) {
      return {
        width: '100%',
        height: '100%',
        position: 'absolute' as const,
        top: '0',
        left: '0'
      };
    }
    
    const [imageWidth, imageHeight] = file.imageDimensions;
    const imageAspectRatio = imageWidth / imageHeight;
    const containerAspectRatio = containerWidth / containerHeight;
    
    let displayWidth: number;
    let displayHeight: number;
    let offsetX: number;
    let offsetY: number;
    
    if (imageAspectRatio > containerAspectRatio) {
      // Image is wider - fit to width
      displayWidth = containerWidth;
      displayHeight = containerWidth / imageAspectRatio;
      offsetX = 0;
      offsetY = (containerHeight - displayHeight) / 2;
    } else {
      // Image is taller - fit to height
      displayHeight = containerHeight;
      displayWidth = containerHeight * imageAspectRatio;
      offsetX = (containerWidth - displayWidth) / 2;
      offsetY = 0;
    }
    
    console.log('imageStyle calculated:', {
      imageDimensions: [imageWidth, imageHeight],
      containerSize: [containerWidth, containerHeight],
      display: [displayWidth, displayHeight],
      offset: [offsetX, offsetY]
    });
    
    return {
      width: `${displayWidth}px`,
      height: `${displayHeight}px`,
      position: 'absolute' as const,
      top: `${offsetY}px`,
      left: `${offsetX}px`
    };
  });
  
  // Get current media source based on fileId or fallback to targetFile
  const currentMediaSrc = () => {
    // If fileId is provided, use that specific file
    if (props.fileId) {
      const file = mediaState.uploadedFiles.find(f => f.id === props.fileId);
      if (file?.filepath) {
        return file.filepath;
      }
    }
    
    // Otherwise use targetFile or fallback to original media
    const currentFile = getCurrentFile(editorState, mediaState);
    if (currentFile?.filepath) {
      return currentFile.filepath;
    }
    
    // Final fallback to original media
    return mediaSrc;
  };

  // Load image and set up source with fallback
  async function loadImage() {
    const src = currentMediaSrc();
    
    if (mediaType === 'image') {
      // If it's a blob URL or already a full URL, use it directly
      if (src.startsWith('blob:') || src.startsWith('http')) {
        setImageSrc(src);
        return;
      }
      
      // Try local path first, then fallback to API
      const { localSrc, apiSrc } = getImageSrcWithFallback(src);
      
      // Test if local path works
      const testImg = new Image();
      testImg.crossOrigin = 'anonymous';
      
      testImg.onload = () => {
        setImageSrc(localSrc);
      };
      
      testImg.onerror = () => {
        // If local path fails, try API path
        const testImg2 = new Image();
        testImg2.crossOrigin = 'anonymous';
        
        testImg2.onload = () => {
          setImageSrc(apiSrc);
        };
        
        testImg2.onerror = () => {
          console.warn(`Failed to load image from both local (${localSrc}) and API (${apiSrc}) paths`);
        };
        
        testImg2.src = apiSrc;
      };
      
      testImg.src = localSrc;
    }
  }

  // Handle image load to set dimensions
  const handleImageLoad = (event: Event) => {
    const img = event.target as HTMLImageElement;
    
    // Get the current file (either by fileId or targetFile)
    const currentFile = props.fileId 
      ? mediaState.uploadedFiles.find(f => f.id === props.fileId)
      : getCurrentFile(editorState, mediaState);
    
    // Store image dimensions in the file
    if (currentFile) {
      currentFile.imageDimensions = [img.naturalWidth, img.naturalHeight];
      
      // Set referenceSize only once (original dimensions for scaling calculations)
      if (!currentFile.referenceSize) {
        currentFile.referenceSize = [img.naturalWidth, img.naturalHeight];
      }
    }

    // Set initial ratio for the first image only (for backward compatibility)
    if (!mediaState.currentImageRatio) {
      const ratio = img.naturalWidth / img.naturalHeight;
      actions.setInitialImageRatio(ratio);
      mediaState.currentImageRatio = ratio;
    }
    
    setImageLoaded(true);
    
    // Notify parent about image element
    if (props.onImageElementReady) {
      props.onImageElementReady(img);
    }
  };
  
  // Load image when component mounts or when we have a valid source
  createEffect(() => {
    const src = currentMediaSrc();
    if (src) {
      loadImage();
    }
  });
  
  // Отслеживаем размеры контейнера
  onMount(() => {
    if (!containerElement) return;
    
    const updateContainerSize = () => {
      const rect = containerElement.getBoundingClientRect();
      setContainerSize([rect.width, rect.height]);
    };
    
    // Initial size
    updateContainerSize();
    
    // Watch for resize
    const resizeObserver = new ResizeObserver(updateContainerSize);
    resizeObserver.observe(containerElement);
    
    // Fallback to window resize
    window.addEventListener('resize', updateContainerSize);
    
    onCleanup(() => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateContainerSize);
    });
  });
  
  return (
    <div 
      ref={containerElement}
      class="image-display-container" 
      style="position: relative; width: 100%; height: 100%;"
    >
      {imageSrc() && (
        <img 
          ref={imageElement}
          src={imageSrc()}
          alt="Media content"
          class="media-image"
          onLoad={handleImageLoad}
          onError={() => {
            setImageLoaded(false);
            if (props.onImageElementReady) {
              props.onImageElementReady(null);
            }
          }}
          style={imageStyle()}
        />
      )}
    </div>
  );
}
