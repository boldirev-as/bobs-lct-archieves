import {Accessor, createContext, createEffect, createMemo, createSignal, For, JSX, onCleanup, onMount} from 'solid-js';

import Scrollable from '../../scrollable';

import {useMediaEditorContext} from '../context';

type TabContentContextValue = {
  container: Accessor<HTMLDivElement>;
  scrollAmount: Accessor<number>;
};
export const TabContentContext = createContext<TabContentContextValue>();

type Props = {
  tabs: Record<string, () => JSX.Element>;
  onContainer: (el: HTMLDivElement) => void;
  onScroll: () => void;
  currentTab?: string;
  scrollable?: boolean;
};

export default function TabContent(props: Props) {
  const {editorState} = useMediaEditorContext();

  const activeTab = createMemo(() => {
    const tab = props.currentTab ?? editorState.currentTab;
    return tab;
  });

  const [container, setContainer] = createSignal<HTMLDivElement>();
  const [scrollAmount, setScrollAmount] = createSignal(0);
  
  const tabKeys = createMemo(() => Object.keys(props.tabs));
  let scrollable: Scrollable;
  let prevTab = activeTab();
  let tabElements: Map<string, HTMLDivElement> = new Map();
  let animationFrameId: number | null = null;
  
  // JS-based animation
  const animateTabSwitch = (fromTab: string, toTab: string) => {
    const fromEl = tabElements.get(fromTab);
    const toEl = tabElements.get(toTab);
    
    if (!fromEl || !toEl) return;
    
    // Determine direction based on tab indices
    const keys = tabKeys();
    const fromIndex = keys.indexOf(fromTab);
    const toIndex = keys.indexOf(toTab);
    
    if (fromIndex === -1 || toIndex === -1) return;
    
    const toRight = toIndex > fromIndex;
    const direction = toRight ? 1 : -1;
    
    // Disable CSS transitions
    fromEl.style.transition = 'none';
    toEl.style.transition = 'none';
    
    // Initial positions - both tabs start visible
    fromEl.style.transform = 'translateX(0)';
    fromEl.style.opacity = '1';
    fromEl.style.pointerEvents = 'auto';
    fromEl.style.zIndex = '9';
    
    toEl.style.transform = `translateX(${direction * 100}%)`;
    toEl.style.opacity = '1';
    toEl.style.pointerEvents = 'none';
    toEl.style.zIndex = '10';
    
    // Force reflow
    void toEl.offsetHeight;
    
    // Animate
    const startTime = performance.now();
    const duration = 200; // 200ms
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out)
      const eased = 1 - Math.pow(1 - progress, 3);
      
      // Both tabs move together in the same direction
      fromEl.style.transform = `translateX(${-direction * eased * 100}%)`;
      fromEl.style.opacity = '1';
      
      toEl.style.transform = `translateX(${direction * (1 - eased) * 100}%)`;
      toEl.style.opacity = '1';
      
      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        // Animation complete - reset all tabs to default state
        tabElements.forEach((el, key) => {
          if (key === toTab) {
            el.style.transform = 'translateX(0)';
            el.style.opacity = '1';
            el.style.pointerEvents = 'auto';
            el.style.zIndex = '10';
          } else {
            el.style.transform = 'translateX(0)';
            el.style.opacity = '0';
            el.style.pointerEvents = 'none';
            el.style.zIndex = '1';
          }
        });
        animationFrameId = null;
      }
    };
    
    animationFrameId = requestAnimationFrame(animate);
  };
  
  // Watch for tab changes
  createEffect(() => {
    const currentTab = activeTab();
    if (prevTab !== currentTab && tabElements.size > 0) {
      // Cancel any ongoing animation
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      animateTabSwitch(prevTab, currentTab);
      prevTab = currentTab;
    }
  });

  onMount(() => {
    const containerEl = container();
    if (props.scrollable && containerEl) {
      scrollable = new Scrollable(containerEl);
      scrollable.setListeners();
      scrollable.container.addEventListener('scroll', () => {
        props.onScroll();
        setScrollAmount(scrollable.container.scrollTop);
      });
    }
  });
  
  onCleanup(() => {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
    }
    scrollable?.destroy?.();
  });

  return (
    <div
      ref={(el) => {
        setContainer(el);
        props.onContainer(el);
      }}
      class="media-editor__tab-content"
      style="position: relative; overflow: hidden;"
    >
      <For each={tabKeys()}>
        {(tabKey) => {
          const isActive = activeTab() === tabKey;
          return (
            <div 
              ref={(el) => tabElements.set(tabKey, el)}
              class="media-editor__tab-content-scrollable-content"
              style={`position: absolute; top: 0; left: 0; right: 0; bottom: 0; opacity: ${isActive ? 1 : 0}; pointer-events: ${isActive ? 'auto' : 'none'}; z-index: ${isActive ? 10 : 1}; transform: translateX(0); transition: none !important;`}
            >
              <TabContentContext.Provider value={{container, scrollAmount}}>
                {props.tabs[tabKey]()}
              </TabContentContext.Provider>
            </div>
          );
        }}
      </For>
    </div>
  );
}