// Type definitions for Swiper Element
declare module 'swiper/element/bundle' {
  export function register(): void;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'swiper-container': {
        ref?: any;
        class?: string;
        init?: string;
        'slides-per-view'?: string | number;
        'space-between'?: string | number;
        navigation?: string | boolean;
        pagination?: string | boolean;
        keyboard?: string | boolean;
        mousewheel?: string | boolean;
        thumbs?: string | boolean;
        'initial-slide'?: string | number;
        'events-prefix'?: string;
        children?: any;
      };
      'swiper-slide': {
        class?: string;
        lazy?: string | boolean;
        children?: any;
      };
    }
  }
  
  interface HTMLElement {
    swiper?: any;
    initialize?: () => void;
  }
}
