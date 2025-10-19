import {JSX} from 'solid-js';
import {IconTsx} from '../iconTsx';
import ripple from '../ripple'; ripple;

interface BottomButtonProps {
  onClick: () => void;
  icon?: Icon;
  children: JSX.Element;
  disabled?: boolean;
  class?: string;
  style?: string | JSX.CSSProperties;
}

export default function BottomButton(props: BottomButtonProps) {
  return (
    <div class={`bottom-button-wrapper ${props.class || ''}`} style={props.style}>
      <button
        class="bottom-button"
        onClick={props.onClick}
        disabled={props.disabled}
        use:ripple
      >
        {props.icon && <IconTsx icon={props.icon} />}
        <div>
          {props.children}
        </div>
      </button>
    </div>
  );
}