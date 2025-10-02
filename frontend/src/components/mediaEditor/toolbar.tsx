import {batch, createEffect, createMemo, createSignal, JSX, on, onCleanup, onMount} from 'solid-js';
import {modifyMutable, produce} from 'solid-js/store';

import {doubleRaf} from '../../helpers/schedulers';

import {animateValue, delay, lerp} from './utils';
import {useMediaEditorContext} from './context';
import {getCurrentRenderingPayload} from './utils';
import TabContent from './tabs/tabContent';
import useIsMobile from './useIsMobile';
import TextTab from './tabs/textTab';
import InfoTab from './tabs/infoTab';
import ExportTab from './tabs/exportTab';
import Tabs from './tabs/tabs';
import Topbar from './topbar';
import FilesList from './filesList';

import './filesList.scss';
import './globalTabsHeader.scss';


export default function Toolbar(props: {onClose: () => void}) {
  let toolbar: HTMLDivElement;

  const {editorState, actions, mediaState} = useMediaEditorContext();

  const [move, setMove] = createSignal(0);
  const [isCollapsed, setIsCollapsed] = createSignal(false);
  const [container, setContainer] = createSignal<HTMLDivElement>();
  const [containerHeight, setContainerHeight] = createSignal(0);
  const [extraMove, setExtraMove] = createSignal(0);
  
  // Global tabs state - automatically switch to tab2 if targetFile exists
  const [globalCurrentTab, setGlobalCurrentTab] = createSignal('tab1');
  
  // Polling interval for file status updates
  let pollInterval: ReturnType<typeof setInterval> | undefined;
  
  // Watch for targetFile changes and update tab accordingly
  createEffect(() => {
    if (editorState.targetFile) {
      setGlobalCurrentTab('tab2');
    } else {
      setGlobalCurrentTab('tab1');
    }
  });
  
  const handleTabChange = (tab: string) => {
    // If switching to tab1, clear targetFile
    if (tab === 'tab1') {
      modifyMutable(editorState, produce((state) => {
        state.targetFile = undefined;
      }));
    }
    // If switching to tab2 but no targetFile, do nothing (stay on tab1)
    if (tab === 'tab2' && !editorState.targetFile) {
      return;
    }
    setGlobalCurrentTab(tab);
  };

  const isMobile = useIsMobile();

  const [shouldHide, setShouldHide] = createSignal(isMobile());

  let startY = 0;
  let isAborted = true;
  let isResetting = false;
  let canMove = false;

  function resetMove() {
    if(isResetting) return;
    isResetting = true;

    startY = 0;
    isAborted = true;
    animateValue(move(), 0, 200, setMove);
    setTimeout(() => {
      isResetting = false;
    }, 200);
  }
  actions.abortDrawerSlide = () => resetMove();

  onMount(() => {
    function startDrag(y: number) {
      if(!isMobile()) return;
      startY = y;
      isAborted = false;
      canMove = false;
      setTimeout(() => {
        canMove = true;
      }, 100); // wait for scroll to trigger first
    }
    function dragMove(y: number) {
      if(!isMobile()) return;
      if(isAborted) return;
      if(!canMove) return;
      const diff = y - startY;
      if(isCollapsed()) setMove(Math.min(Math.max(-containerHeight(), diff), 0));
      else setMove(Math.max(Math.min(containerHeight(), diff), 0));
    }
    function dragEnd() {
      if(!isMobile()) return;
      if(isAborted) return;
      isAborted = true;
      if(Math.abs(move()) > 100) {
        setIsCollapsed((prev) => !prev);
      } else {
        resetMove();
      }
    }

    container().addEventListener('input', () => {
      resetMove();
    });

    toolbar.addEventListener('touchstart', (e) => {
      startDrag(e.touches[0].clientY);
    });
    toolbar.addEventListener('touchmove', (e) => {
      dragMove(e.touches[0].clientY);
    });
    toolbar.addEventListener('touchend', (e) => {
      dragEnd();
    });
    toolbar.addEventListener('mousedown', (e) => {
      startDrag(e.clientY);
    });
    toolbar.addEventListener('mousemove', (e) => {
      dragMove(e.clientY);
    });
    toolbar.addEventListener('mouseup', (e) => {
      dragEnd();
    });
    toolbar.addEventListener('mouseout', (e) => {
      dragEnd();
    });
  });

  createEffect(() => {
    const observer = new ResizeObserver(() => {
      setContainerHeight(container()?.clientHeight || 0);
    });
    observer.observe(container());
    onCleanup(() => observer.disconnect());
  });

  createEffect(
    on(isCollapsed, () => {
      const initialMove = move();
      const initialExtraMove = extraMove();
      const targetExtraMove = isCollapsed() ? containerHeight() : 0;
      animateValue(0, 1, 200, (progress) => {
        batch(() => {
          setMove(lerp(initialMove, 0, progress));
          setExtraMove(lerp(initialExtraMove, targetExtraMove, progress));
        });
      });
    })
  );

  createEffect(() => {
    if(editorState.currentTab !== 'crop') setIsCollapsed(false);
  });

  createEffect(() => {
    const renderingPayload = getCurrentRenderingPayload(editorState, mediaState);
    if(renderingPayload && shouldHide()) {
      (async() => {
        toolbar.style.transition = '.2s';
        await doubleRaf();
        setShouldHide(false);
        await delay(200);
        toolbar.style.removeProperty('transition');
      })();
    }
  });

  // Polling logic for all files
  const pollAllFiles = async () => {
    console.log('Toolbar polling all files');
    const filesToPoll = mediaState.uploadedFiles.filter(file => 
      file.status !== 'error' && file.status !== 'done' && 
      file.id
    );

    console.log('Toolbar polling files:', filesToPoll.length);

    if (filesToPoll.length === 0) {
      // No files to poll, stop the interval
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = undefined;
        console.log('Toolbar stopped polling - no files to poll');
      }
      return;
    }

    // Poll each file
    for (const file of filesToPoll) {
      try {
        const response = await fetch(`/api/recognition-status/${file.id}`);
        if (!response.ok) {
          console.warn(`Status check failed for ${file.id}: ${response.statusText}`);
          continue;
        }

        const statusData = await response.json();
        console.log(`Toolbar - File ${file.id} status:`, statusData.status);
        
        // Map server status to frontend status
        let mappedStatus: 'pending' | 'processing' | 'done' | 'error';
        switch (statusData.status) {
          case 'uploading':
          case 'in-queue':
            mappedStatus = 'pending';
            break;
          case 'processing':
            mappedStatus = 'processing';
            break;
          case 'done':
            mappedStatus = 'done';
            break;
          case 'fail':
            mappedStatus = 'error';
            break;
          default:
            mappedStatus = 'processing';
        }

        // Update file status
        modifyMutable(mediaState, produce(state => {
          const fileToUpdate = state.uploadedFiles.find(f => f.id === file.id);
          if (fileToUpdate) {
            fileToUpdate.status = mappedStatus;
            fileToUpdate.result = statusData.result;
            fileToUpdate.error = statusData.status === 'fail' ? 'Processing failed' : undefined;
            
            // Update filepath when done
            if (statusData.status === 'done' && statusData.filepath) {
              // Clean up local blob URL
              if (fileToUpdate.filepath && fileToUpdate.filepath.startsWith('blob:')) {
                URL.revokeObjectURL(fileToUpdate.filepath);
              }
              fileToUpdate.filepath = statusData.filepath;
            }
          }
        }));

      } catch (error) {
        console.warn(`Toolbar polling failed for ${file.id}:`, error);
        // Update file to error status
        modifyMutable(mediaState, produce(state => {
          const fileToUpdate = state.uploadedFiles.find(f => f.id === file.id);
          if (fileToUpdate) {
            fileToUpdate.status = 'error';
            fileToUpdate.error = error instanceof Error ? error.message : String(error);
          }
        }));
      }
    }
  };

  createEffect(() => {
    const needsPolling = mediaState.uploadedFiles.some(file => 
      file.status !== 'error' && file.status !== 'done'
    );

    console.log('Toolbar polling effect - needsPolling123:', needsPolling, 'hasInterval:', !!pollInterval);

    if (needsPolling && !pollInterval) {
      console.log('Starting polling in Toolbar');
      pollInterval = setInterval(pollAllFiles, 1000);
      pollAllFiles(); // Poll immediately
    } else if (!needsPolling && pollInterval) {
      console.log('Stopping polling in Toolbar');
      clearInterval(pollInterval);
      pollInterval = undefined;
    }
  });

  // Cleanup polling on unmount
  onCleanup(() => {
    if (pollInterval) {
      clearInterval(pollInterval);
      console.log('Toolbar cleanup - stopped polling');
    }
  });

  const totalMove = () => extraMove() + move();

  const style = createMemo((): JSX.CSSProperties => {
    if(isMobile()) return {
      'opacity': editorState.isAdjusting ? 0 : 1,
      'transform': shouldHide() ?
        'translate(-50%, 100%)' :
        `translate(-50%, ${totalMove()}px)`
    };
  });

  const onClose = () => {
    editorState.targetFile = undefined;
  }

  return (
    <div
      ref={toolbar}
      class="media-editor__toolbar"
      style={style()}
    >
        <TabContent
          onContainer={setContainer}
          onScroll={() => {
            resetMove();
          }}
          scrollable={false}
          currentTab={globalCurrentTab()}
          tabs={{
            tab1: () => (
              <div id='tab1 media-editor__toolbar-draggable'>
                <FilesList />
              </div>
            ),
            tab2: () => (
              <div id='tab2 tabs media-editor__toolbar-draggable'>
                <Topbar onClose={onClose} />
                <Tabs />
                <TabContent
                  onContainer={setContainer}
                  onScroll={() => {
                    resetMove();
                  }}
                  scrollable={true}
                  tabs={{
                    info: () => <InfoTab />,
                    text: () => <TextTab />,
                    download: () => <ExportTab />
                  }}
                />
              </div>
            )
          }}
        />
    </div>
  );
}
