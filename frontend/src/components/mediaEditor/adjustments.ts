
export type AdjustmentsConfig = typeof adjustmentsConfig;

export type AdjustmentKey = AdjustmentsConfig[number]['key'];

export const adjustmentsConfig = [
  {
    key: 'enhance',
    uniform: 'uEnhance',
    label: () => 'Enhance',
    to100: true
  },
  {
    key: 'brightness',
    uniform: 'uBrightness',
    label: () => 'Brightness',
    to100: false
  },
  {
    key: 'contrast',
    uniform: 'uContrast',
    label: () => 'Contrast',
    to100: false
  },
  {
    key: 'saturation',
    uniform: 'uSaturation',
    label: () => 'Saturation',
    to100: false
  },
  {
    key: 'warmth',
    uniform: 'uWarmth',
    label: () => 'Warmth',
    to100: false
  },
  {
    key: 'fade',
    uniform: 'uFade',
    label: () => 'Fade',
    to100: true
  },
  {
    key: 'highlights',
    uniform: 'uHighlights',
    label: () => 'Highlights',
    to100: false
  },
  {
    key: 'shadows',
    uniform: 'uShadows',
    label: () => 'Shadows',
    to100: false
  },
  {
    key: 'vignette',
    uniform: 'uVignette',
    label: () => 'Vignette',
    to100: true
  },
  {
    key: 'grain',
    uniform: 'uGrain',
    label: () => 'Grain',
    to100: true
  },
  {
    key: 'sharpen',
    uniform: 'uSharpen',
    label: () => 'Sharpen',
    to100: true
  }
] as const;
