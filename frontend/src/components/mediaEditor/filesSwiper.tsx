import {createEffect, createSignal, For, onMount} from 'solid-js';
import {useMediaEditorContext} from './context';
import MainCanvas from './canvas/mainCanvas';
import BlockSelectionOverlay from './blockSelectionOverlay';
import ExportOverlay from './exportOverlay';

export default function FilesSwiper() {
  const {mediaState, editorState, actions} = useMediaEditorContext();
  let swiperRef: HTMLElement;

  // Register Swiper elements
  onMount(async () => {
    const { register } = await import('swiper/element/bundle');
    register();
    
    // Initialize swiper after registration
    if (swiperRef) {
      swiperRef.initialize?.();
    }
  });

  // Sync swiper with targetFile changes
  createEffect(() => {
    console.log('createEffect', swiperRef, editorState.targetFile);
    if (swiperRef?.swiper && editorState.targetFile) {
      const targetIndex = mediaState.uploadedFiles.findIndex(file => file.id === editorState.targetFile?.id);

      swiperRef.swiper.slideTo(targetIndex);
    }

    const handleSlideChange = ({ activeIndex }: any) => {
      setActiveSlideIndex(activeIndex);
    };
  
    if (swiperRef?.swiper) {
      console.log('swiperRef.swiper', swiperRef.swiper);
      swiperRef.swiper.on('slideChange', handleSlideChange);
    }
  });


  const [activeSlideIndex, setActiveSlideIndex] = createSignal(0);
  const hasSelectedLayer = () => !!editorState.targetFile;

  return (
    <div class="files-swiper-container">
      <swiper-container
        ref={swiperRef}
        slides-per-view={1}
        space-between={0}
        init="false"
        keyboard={true}
        class="files-swiper"
        classList={{"swiper-no-swiping": hasSelectedLayer()}}
      >
        <For each={mediaState.uploadedFiles}>
          {(file, index) => (
            <swiper-slide class="files-swiper-slide">
              <div class="files-swiper-slide-content">
                {/* Each slide has its own MainCanvas with file-specific state */}
                <MainCanvas
                  fileId={file.id}
                  fileIndex={index()}
                  isInView={activeSlideIndex() === index()}
                />
                {/* Block selection overlay for entity creation */}
                <BlockSelectionOverlay
                  fileId={file.id}
                  fileIndex={index()}
                />
                {/* Export overlay for showing entities and blocks */}
                <ExportOverlay
                  fileId={file.id}
                  fileIndex={index()}
                />
              </div>
            </swiper-slide>
          )}
        </For>
      </swiper-container>
    </div>
  );
}
