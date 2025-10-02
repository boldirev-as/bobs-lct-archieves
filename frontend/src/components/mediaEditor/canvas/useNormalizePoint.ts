import {createMemo, Accessor} from 'solid-js';
import {NumberPair} from '../types';

interface UseNormalizePointOptions {
  canvasSize: NumberPair;
  finalTransform: {
    flip: NumberPair;
    rotation: number;
    scale: number;
    translation: NumberPair;
  };
  pixelRatio: number;
}

export default function useNormalizePoint(options: UseNormalizePointOptions) {
  const { canvasSize, finalTransform, pixelRatio } = options;

  // Use canvas size like in the working version
  const size = createMemo(() => {
    const size = canvasSize.map((x) => x * pixelRatio);
    return size;
  });

  return (point: NumberPair) => {
    const transform = finalTransform;
    const [w, h] = size();

    // ВАЖНО: Масштабируем входящую точку на pixelRatio (как в рабочей версии)
    point = point.map((x) => x * pixelRatio) as NumberPair;

    // Same logic as working version - no image offset
    const beforeTransform = [
      (point[0] - transform.translation[0] - w / 2) / transform.scale,
      (point[1] - transform.translation[1] - h / 2) / transform.scale
    ];
    const r = [Math.sin(transform.rotation), Math.cos(transform.rotation)];
    const result: NumberPair = [beforeTransform[0] * r[1] + beforeTransform[1] * r[0], beforeTransform[1] * r[1] - beforeTransform[0] * r[0]];
    
    return result;
  };
}
