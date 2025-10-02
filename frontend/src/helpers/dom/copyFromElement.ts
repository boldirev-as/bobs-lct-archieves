
import {copyTextToClipboard} from '../clipboard';
// import SelectionSaver from "../selectionSaver";
// import selectElementContents from "./selectElementContents";

export default function copyFromElement(element: HTMLElement) {
  copyTextToClipboard(element.textContent);
  // const saver = new SelectionSaver();
  // saver.save();
  // selectElementContents(element);
  // document.execCommand('copy');
  // saver.restore();
}
