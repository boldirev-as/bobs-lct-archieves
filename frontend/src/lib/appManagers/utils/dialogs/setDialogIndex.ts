
import type {AnyDialog} from '../../../storages/dialogs';
import type {Dialog} from '../../appMessagesManager';
import type getDialogIndexKey from './getDialogIndexKey';

export default function setDialogIndex(
  dialog: AnyDialog,
  indexKey: ReturnType<typeof getDialogIndexKey>,
  index: number
) {
  return (dialog as Dialog)[indexKey] = index;
}
