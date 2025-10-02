
import {SliderSuperTabEventable} from '../../../sliderTab';
import PrivacySection from '../../../privacySection';
import {LangPackKey} from '../../../../lib/langPack';
import PrivacyType from '../../../../lib/appManagers/utils/privacy/privacyType';

export default class AppPrivacyAboutTab extends SliderSuperTabEventable {
  public init() {
    this.container.classList.add('privacy-tab', 'privacy-about');
    this.setTitle('UserBio');

    const caption: LangPackKey = 'Privacy.BioCaption';
    new PrivacySection({
      tab: this,
      title: 'Privacy.Bio',
      inputKey: 'inputPrivacyKeyAbout',
      captions: [caption, caption, caption],
      exceptionTexts: ['PrivacySettingsController.NeverAllow', 'PrivacySettingsController.AlwaysAllow'],
      appendTo: this.scrollable,
      skipTypes: [PrivacyType.Nobody],
      managers: this.managers
    });
  }
}
