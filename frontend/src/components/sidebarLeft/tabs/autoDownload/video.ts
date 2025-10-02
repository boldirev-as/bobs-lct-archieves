
import {SliderSuperTabEventable} from '../../../sliderTab';
import {autoDownloadPeerTypeSection} from './photo';

export default class AppAutoDownloadVideoTab extends SliderSuperTabEventable {
  public init() {
    this.setTitle('AutoDownloadVideos');

    const section = autoDownloadPeerTypeSection('video', 'AutoDownloadVideosTitle', this.listenerSetter);
    this.scrollable.append(section.container);
  }
}
