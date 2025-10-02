import {createSignal, onCleanup, onMount, Show} from 'solid-js';
import rootScope from '../../../lib/rootScope';
import {PreloaderTsx} from '../../putPreloader';
import {MyStarGift} from '../../../lib/appManagers/appGiftsManager';
import {inputStarGiftEquals} from '../../../lib/appManagers/utils/gifts/inputStarGiftEquals';
import PopupElement from '../../popups';
import PopupStarGiftInfo from '../../popups/starGiftInfo';
import ListenerSetter from '../../../helpers/listenerSetter';
import {StarGiftsGrid} from '../../stargifts/stargiftsGrid';
import {StarGift} from '../../../layer';
import {updateStarGift} from '../../../lib/appManagers/utils/gifts/updateStarGift';

export function StarGiftsProfileTab(props: {
  peerId: PeerId
  scrollParent?: HTMLElement
  onCountChange?: (count: number) => void
}) {
  const [list, setList] = createSignal<MyStarGift[]>([]);
  const [hasMore, setHasMore] = createSignal(true);

  let currentOffset = '';
  let isLoading = false;
  async function loadNext(reload = false) {
    if(isLoading || !hasMore()) return;
    isLoading = true;
    const res = await rootScope.managers.appGiftsManager.getProfileGifts({
      peerId: props.peerId,
      offset: currentOffset,
      limit: 99 // divisible by 3 to avoid grid jumping
    });
    currentOffset = res.next;
    setList(reload ? res.gifts : list().concat(res.gifts));
    setHasMore(Boolean(res.next))
    props.onCountChange?.(res.count);
    isLoading = false;
  }

  function onScroll(event: Event) {
    if(!hasMore()) return;
    const el = event.target as HTMLElement;
    if(el.scrollTop + el.clientHeight >= el.scrollHeight - 300) {
      loadNext();
    }
  }

  const listenerSetter = new ListenerSetter();

  onMount(() => {
    loadNext()
    listenerSetter.add(rootScope)('star_gift_update', (event) => {
      const idx = list().findIndex((it) => inputStarGiftEquals(it.input, event.input));
      if(idx !== -1) {
        let newList = list().slice();
        // create a new object to force re-render
        const newItem = {...newList[idx]};
        newList[idx] = newItem;

        updateStarGift(newItem, event);
        if(event.togglePinned) {
          newList = newList.sort((a, b) => {
            if(a.saved.pFlags.pinned_to_top && !b.saved.pFlags.pinned_to_top) return -1;
            if(!a.saved.pFlags.pinned_to_top && b.saved.pFlags.pinned_to_top) return 1;
            return b.saved.date - a.saved.date;
          })
        }

        setList(newList);
      }
    });

    listenerSetter.add(rootScope)('star_gift_list_update', ({peerId}) => {
      // refetch list
      currentOffset = ''
      setHasMore(true)
      loadNext(true)
    })
  });

  onCleanup(() => listenerSetter.removeAll());

  const render = (
    <div class="star-gifts-profile-tab" onScroll={onScroll}>
      <Show when={!list().length && hasMore()}>
        <PreloaderTsx />
      </Show>
      <StarGiftsGrid
        items={list()}
        view='profile'
        scrollParent={props.scrollParent}
        autoplay={false}
        onClick={(item) => {
          PopupElement.createPopup(PopupStarGiftInfo, {gift: item});
        }}
      />
    </div>
  );

  return {render, loadNext};
}
