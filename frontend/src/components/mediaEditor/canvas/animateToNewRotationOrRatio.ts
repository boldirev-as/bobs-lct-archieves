import {modifyMutable, produce} from 'solid-js/store'

import {animateValue, lerp, lerpArray, snapToViewport, getCurrentFile} from '../utils';
import {useMediaEditorContext} from '../context';
import {NumberPair} from '../types';

import {useCropOffset} from './useCropOffset';

export function animateToNewRotationOrRatio(newRotation: number) {
  const {editorState, mediaState} = useMediaEditorContext();
  
  // Get image dimensions from current file
  const targetFile = getCurrentFile(editorState, mediaState);
  const imageDimensions = targetFile?.imageDimensions;
  if (!imageDimensions) return;

  const cropOffset = useCropOffset();

  const [w, h] = imageDimensions;

  const snappedRotation90 = Math.round((newRotation / Math.PI) * 2);
  const isReversedRatio = Math.abs(snappedRotation90) & 1;
  const snappedRotation = (snappedRotation90 * Math.PI) / 2;

  let ratio: number;

  if(targetFile?.fixedImageRatioKey?.includes('x')) {
    const parts = targetFile.fixedImageRatioKey.split('x');
    ratio = parseInt(parts[0]) / parseInt(parts[1]);
  } else {
    ratio = isReversedRatio ? h / w : w / h;
  }

  const originalRatio = w / h;

  const [w1, h1] = snapToViewport(originalRatio, cropOffset().width, cropOffset().height);
  const [w2, h2] = snapToViewport(ratio, cropOffset().width, cropOffset().height);

  // Use file-specific transforms only
  if (!targetFile?.transform) {
    // Initialize transform if it doesn't exist
    targetFile.transform = {
      flip: [1, 1] as NumberPair,
      rotation: 0,
      scale: 1,
      translation: [0, 0] as NumberPair
    };
  }
  
  const initialScale = targetFile.transform.scale;
  const initialTranslation = targetFile.transform.translation;
  const initialRotation = targetFile.transform.rotation;
  const targetScale = isReversedRatio ? Math.max(w2 / h1, h2 / w1) : Math.max(w2 / w1, h2 / h1);
  const targetTranslation = [0, 0];
  const targetRotation = snappedRotation;

  mediaState.currentImageRatio = ratio;
  editorState.isMoving = true;

  animateValue(
    0,
    1,
    200,
    (progress) => {
      if (targetFile) {
        // Update file-specific transforms
        if (!targetFile.transform) {
          targetFile.transform = {
            flip: [1, 1] as NumberPair,
            rotation: 0,
            scale: 1,
            translation: [0, 0] as NumberPair
          };
        }
        
        targetFile.transform.scale = lerp(initialScale, targetScale, progress);
        targetFile.transform.translation = lerpArray(initialTranslation, targetTranslation, progress) as NumberPair;
        targetFile.transform.rotation = lerp(initialRotation, targetRotation, progress);
      }
    },
    {
      onEnd: () => {
        editorState.isMoving = false;
        if (targetFile?.transform) {
          targetFile.transform.rotation = targetFile.transform.rotation % (Math.PI * 2);
        }
      }
    }
  );
}
