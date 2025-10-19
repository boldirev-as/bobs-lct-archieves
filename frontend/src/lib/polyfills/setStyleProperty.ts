/**
 * Polyfill for setStyleProperty function that was missing in solid-js/web
 * This function sets a CSS style property on an element
 */
function setStyleProperty(element: Element, property: string, value: string | null): void {
  const htmlElement = element as HTMLElement;
  if (value == null) {
    htmlElement.style.removeProperty(property);
  } else {
    htmlElement.style.setProperty(property, value);
  }
}

// Try to add setStyleProperty to solid-js/web module
try {
  const solidWeb = require('solid-js/web');
  if (solidWeb && !solidWeb.setStyleProperty) {
    solidWeb.setStyleProperty = setStyleProperty;
  }
} catch (e) {
  // Fallback: add to window object
  (window as any).setStyleProperty = setStyleProperty;
}

// TypeScript module augmentation
declare module 'solid-js/web' {
  export function setStyleProperty(element: Element, property: string, value: string | null): void;
}

export { setStyleProperty };
