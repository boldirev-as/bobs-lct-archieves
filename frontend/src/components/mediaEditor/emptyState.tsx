import {Component} from 'solid-js';
import './emptyState.scss';

const EmptyState: Component<{
  class?: string;
  text?: string;
  size?: number;
}> = (props) => {
  return (
    <div class={`media-editor__empty-state ${props.class || ''}`}>
      <div class="media-editor__empty-state-icon">
        📁
      </div>
      <div class="media-editor__empty-state-text">
        {props.text || 'Нет данных'}
      </div>
    </div>
  );
};

export default EmptyState;