import {createSignal, JSX, createMemo, onMount} from 'solid-js';

interface DoubleRangeSliderProps {
  label: string;
  startValue: number;
  endValue: number;
  min: number;
  max: number;
  onStartChange: (value: number) => void;
  onEndChange: (value: number) => void;
}

export default function DoubleRangeSlider(props: DoubleRangeSliderProps) {
  let containerRef: HTMLDivElement;
  let startThumbRef: HTMLDivElement;
  let endThumbRef: HTMLDivElement;
  
  const [isDragging, setIsDragging] = createSignal<'start' | 'end' | null>(null);

  // Calculate normalized values for positioning
  const startNormalized = createMemo(() => {
    const range = props.max - props.min;
    return range > 0 ? (props.startValue - props.min) / range : 0;
  });

  const endNormalized = createMemo(() => {
    const range = props.max - props.min;
    return range > 0 ? (props.endValue - props.min) / range : 0;
  });

  // Convert mouse position to value
  const getValueFromPosition = (clientX: number): number => {
    if (!containerRef) return props.min;
    
    const rect = containerRef.getBoundingClientRect();
    const trackWidth = rect.width - 20; // Account for thumb width
    const relativeX = clientX - rect.left - 10; // Account for thumb radius
    const normalized = Math.max(0, Math.min(1, relativeX / trackWidth));
    
    return Math.round(props.min + normalized * (props.max - props.min));
  };

  // Handle mouse events
  const handleMouseDown = (thumb: 'start' | 'end') => (e: MouseEvent) => {
    e.preventDefault();
    setIsDragging(thumb);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    const dragging = isDragging();
    if (!dragging) return;

    const newValue = getValueFromPosition(e.clientX);
    
    if (dragging === 'start') {
      const clampedValue = Math.min(newValue, props.endValue);
      props.onStartChange(clampedValue);
    } else {
      const clampedValue = Math.max(newValue, props.startValue);
      props.onEndChange(clampedValue);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(null);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  // Handle track clicks and mousedown
  const handleTrackMouseDown = (e: MouseEvent) => {
    // Prevent event if clicking on a thumb
    if ((e.target as HTMLElement).classList.contains('media-editor__double-range-thumb')) {
      return;
    }
    
    const newValue = getValueFromPosition(e.clientX);
    const startDistance = Math.abs(newValue - props.startValue);
    const endDistance = Math.abs(newValue - props.endValue);
    
    // Move the closest thumb and start dragging it
    if (startDistance < endDistance) {
      const clampedValue = Math.min(newValue, props.endValue);
      props.onStartChange(clampedValue);
      setIsDragging('start');
    } else {
      const clampedValue = Math.max(newValue, props.startValue);
      props.onEndChange(clampedValue);
      setIsDragging('end');
    }
    
    // Start drag immediately
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  onMount(() => {
    // Cleanup on unmount
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  });

  return (
    <div class="media-editor__double-range-slider">
      <div class="media-editor__range-input-row">
        <div class="media-editor__range-input-label">{props.label}</div>
        <div class="media-editor__range-input-value">
          {props.startValue} - {props.endValue}
        </div>
      </div>
      
      <div
        class="media-editor__double-range-track"
        ref={containerRef!}
        onMouseDown={handleTrackMouseDown}
      >
        {/* Background track */}
        <div class="media-editor__double-range-track-bg" />
        
        {/* Active range */}
        <div
          class="media-editor__double-range-track-active"
          style={`left: ${startNormalized() * 100}%; width: ${(endNormalized() - startNormalized()) * 100}%`}
        />
        
        {/* Start thumb */}
        <div
          ref={startThumbRef!}
          class="media-editor__double-range-thumb media-editor__double-range-thumb--start"
          classList={{
            'media-editor__double-range-thumb--dragging': isDragging() === 'start'
          }}
          style={`left: ${startNormalized() * 100}%`}
          onMouseDown={handleMouseDown('start')}
        />
        
        {/* End thumb */}
        <div
          ref={endThumbRef!}
          class="media-editor__double-range-thumb media-editor__double-range-thumb--end"
          classList={{
            'media-editor__double-range-thumb--dragging': isDragging() === 'end'
          }}
          style={`left: ${endNormalized() * 100}%`}
          onMouseDown={handleMouseDown('end')}
        />
      </div>
    </div>
  );
}