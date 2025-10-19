import {IconTsx} from '../iconTsx';
import ripple from '../ripple';

type GlobalTabsHeaderProps = {
  currentTab: string;
  onTabChange: (tab: string) => void;
};

export default function GlobalTabsHeader(props: GlobalTabsHeaderProps) {
  const tabs = [
    { key: 'tab1', label: 'Files', icon: 'folder' as const },
    { key: 'tab2', label: 'Editor', icon: 'edit' as const }
  ];

  return (
    <div class="global-tabs-header">
      {tabs.map((tab) => (
        <button
          class="global-tabs-header__tab"
          classList={{
            'global-tabs-header__tab--active': props.currentTab === tab.key
          }}
          onClick={() => props.onTabChange(tab.key)}
          use:ripple
        >
          <IconTsx icon={tab.icon} />
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
