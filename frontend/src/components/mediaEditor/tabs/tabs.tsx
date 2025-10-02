import {ButtonIconTsx} from '../../buttonIconTsx';
import {createEffect, onMount} from 'solid-js';
import ripple from '../../ripple'; ripple;

import {useMediaEditorContext} from '../context';

type ConfigItem = {
  icon: Icon;
  key: string;
  label: string;
};

const config: ConfigItem[] = [
  {icon: 'info', label: 'Инфо', key: 'info'},
  {icon: 'text', label: 'Текст', key: 'text'},
  {icon: 'download', label: 'Экспорт', key: 'download'},
];

export const mediaEditorTabsOrder = config.map((item) => item.key);

export default function Tabs() {
  const {editorState} = useMediaEditorContext();

  let container: HTMLDivElement;
  let underline: HTMLDivElement;

  const tabs = config.map((item) => ({
    ...item,
    element: (
      <div 
        class="media-editor__tabs-item rp" 
        classList={{'media-editor__tabs-item--active': editorState.currentTab === item.key}}
        onClick={() => onTabClick(item.key)}
        use:ripple
      >
        <ButtonIconTsx icon={item.icon} />
        <span>{item.label}</span>
      </div>
    ) as HTMLElement
  }));

  function updateUnderline(key: string) {
    const target = tabs?.find?.((tab) => tab.key === key).element;
    if (!target || !container) return;
    
    const containerBR = container.getBoundingClientRect();
    const targetBR = target.getBoundingClientRect();

    // Calculate position and width based on content
    const leftPosition = targetBR.left - containerBR.left;
    const contentWidth = targetBR.width;
    
    underline.style.setProperty('--left', leftPosition + 18 + 'px');
    underline.style.setProperty('--width', contentWidth - 32 + 'px');
  }

  function onTabClick(key: string) {
    editorState.currentTab = key;
    updateUnderline(key);
  }

  // Initialize underline position on mount
  onMount(() => {
    setTimeout(() => {
      updateUnderline(editorState.currentTab);
    }, 100);
  });

  // Update underline when tab changes externally
  createEffect(() => {
    setTimeout(() => {
      updateUnderline(editorState.currentTab);
    }, 100);
  });

  return (
    <div ref={container} class="media-editor__tabs">
      {tabs.map((tab) => tab.element)}
      <div ref={underline} class="media-editor__tabs-underline" />
    </div>
  );
}
