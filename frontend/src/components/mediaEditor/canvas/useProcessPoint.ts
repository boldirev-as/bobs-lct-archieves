import {createMemo, Accessor} from 'solid-js';
import {NumberPair} from '../types';

interface UseProcessPointOptions {
  canvasSize: NumberPair;
  finalTransform: {
    flip: NumberPair;
    rotation: number;
    scale: number;
    translation: NumberPair;
  };
  pixelRatio: number;
  densityAware?: boolean;
}

export default function useProcessPoint(options: UseProcessPointOptions) {
  const { canvasSize, finalTransform, pixelRatio, densityAware = true } = options;

  // Use canvas size like in the working version
  const size = createMemo(() => {
    const size = canvasSize.map((x) => x * pixelRatio);
    return size;
  });

  return (point: NumberPair) => {
    const [w, h] = size();

    const transform = finalTransform;
    const r = [Math.sin(-transform.rotation), Math.cos(-transform.rotation)];
    const rotated = [point[0] * r[1] + point[1] * r[0], point[1] * r[1] - point[0] * r[0]];
    
    // Same logic as working version - no image offset
    const result: NumberPair = [
      (rotated[0] * transform.scale + w / 2 + transform.translation[0]) / (densityAware ? 1 : pixelRatio),
      (rotated[1] * transform.scale + h / 2 + transform.translation[1]) / (densityAware ? 1 : pixelRatio)
    ];
    
    return result;
  };
}
