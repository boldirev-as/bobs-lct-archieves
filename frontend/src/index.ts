import './lib/polyfills/setStyleProperty';

import loadFonts from './helpers/dom/loadFonts';
import IS_EMOJI_SUPPORTED from './environment/emojiSupport';
import {IS_ANDROID, IS_APPLE, IS_APPLE_MOBILE, IS_FIREFOX, IS_MOBILE, IS_MOBILE_SAFARI, IS_SAFARI} from './environment/userAgent';
import './materialize.scss';
import './scss/style.scss';
import toggleAttributePolyfill from './helpers/dom/toggleAttributePolyfill';
import IS_TOUCH_SUPPORTED from './environment/touchSupport';
import './lib/polyfill';
import apiManagerProxy from './lib/mtproto/mtprotoworker';
import themeController from './helpers/themeController';
import overlayCounter from './helpers/overlayCounter';
import {IS_OVERLAY_SCROLL_SUPPORTED, USE_CUSTOM_SCROLL, USE_NATIVE_SCROLL} from './environment/overlayScrollSupport';
import replaceChildrenPolyfill from './helpers/dom/replaceChildrenPolyfill';
import listenForWindowPrint from './helpers/dom/windowPrint';
import {openMediaEditor} from './components/mediaEditor/mediaEditor';
import HotReloadGuardProvider from './lib/solidjs/hotReloadGuardProvider';

function setManifest() {
  const manifest = document.getElementById('manifest') as HTMLLinkElement;
  if(manifest) manifest.href = `site${IS_APPLE && !IS_APPLE_MOBILE ? '_apple' : ''}.webmanifest?v=jw3mK7G9Aq`;
}

function setViewportHeightListeners() {
  const w = window.visualViewport || window; // * handle iOS keyboard
  let setViewportVH = false/* , hasFocus = false */;
  let lastVH: number;
  const setVH = () => {
    let vh = (setViewportVH && !overlayCounter.isOverlayActive ? (w as VisualViewport).height || (w as Window).innerHeight : window.innerHeight) * 0.01;
    vh = +vh.toFixed(2);

    lastVH = vh;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  };

  window.addEventListener('resize', setVH);
  setVH();
}

function setRootClasses() {
  const add: string[] = [];

  if(IS_EMOJI_SUPPORTED) {
    add.push('native-emoji');
  }

  if(USE_NATIVE_SCROLL) {
    add.push('native-scroll');
  } else if(IS_OVERLAY_SCROLL_SUPPORTED) {
    add.push('overlay-scroll');
  } else if(USE_CUSTOM_SCROLL) {
    add.push('custom-scroll');
  }

  if(IS_FIREFOX) {
    add.push('is-firefox', 'no-backdrop');
  }

  if(IS_MOBILE) {
    add.push('is-mobile');
  }

  if(IS_APPLE) {
    if(IS_SAFARI) {
      add.push('is-safari');
    }

    // root.classList.add('emoji-supported');

    if(IS_APPLE_MOBILE) {
      add.push('is-ios');
    } else {
      add.push('is-mac');
    }
  } else if(IS_ANDROID) {
    add.push('is-android');
  }

  if(!IS_TOUCH_SUPPORTED) {
    add.push('no-touch');
  } else {
    add.push('is-touch');
  }

  document.documentElement.classList.add(...add);
}

(window as any)['showIconLibrary'] = async() => {
  const {showIconLibrary} = await import('./components/iconLibrary/trigger');
  showIconLibrary();
};

document.addEventListener('DOMContentLoaded', async() => {
  openMediaEditor({
    onClose: (hasGif: boolean) => {
      console.log('Media editor closed, hasGif:', hasGif);
      URL.revokeObjectURL('mediaSrc');
    },
    onCanvasReady: async (canvas: HTMLCanvasElement) => {
      console.log('Canvas ready:', canvas);
    },
    onImageRendered: () => {
      console.log('Image rendered');
    },
    mediaSrc: '',
    mediaType: 'image' as const,
    mediaBlob: new Blob(),
    mediaSize: [600, 600] as [number, number]
  }, HotReloadGuardProvider);

  toggleAttributePolyfill();
  replaceChildrenPolyfill();
  setManifest();
  setViewportHeightListeners();
  listenForWindowPrint();
  setRootClasses();
  await apiManagerProxy.loadAllStates();

  themeController.setThemeListener();
  const fontsPromise = loadFonts();
  await fontsPromise;
});
