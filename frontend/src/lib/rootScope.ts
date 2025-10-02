import type {ConnectionStatusChange} from './mtproto/connectionStatus';
import type {AppManagers} from './appManagers/managers';
import type {StateSettings} from '../config/state';
import type {ArgumentTypes} from '../types';
import {NULL_PEER_ID} from './mtproto/mtproto_config';
import EventListenerBase, {EventListenerListeners} from '../helpers/eventListenerBase';
import {MOUNT_CLASS_TO} from '../config/debug';
import MTProtoMessagePort from './mtproto/mtprotoMessagePort';

export type BroadcastEvents = {
};

export type BroadcastEventsListeners = {
  [name in keyof BroadcastEvents]: (e: BroadcastEvents[name]) => void
};

export class RootScope extends EventListenerBase<BroadcastEventsListeners> {
  public myId: PeerId;
  private connectionStatus: {[name: string]: ConnectionStatusChange};
  public settings: StateSettings;
  public managers: AppManagers;
  public premium: boolean;

  constructor() {
    super();

    this.myId = NULL_PEER_ID;
    this.connectionStatus = {};
    this.premium = false;

    this.dispatchEvent = (e, ...args) => {
      super.dispatchEvent(e, ...args);
      (async() => {
        const accountNumber = this.managers ? await this.managers.apiManager.getAccountNumber() : undefined;
        MTProtoMessagePort.getInstance().invokeVoid('event', {
          name: e as string,
          args,
          accountNumber
        });
      })();
    };
  }

  public getConnectionStatus() {
    return this.connectionStatus;
  }

  public getPremium() {
    return this.premium;
  }

  public getMyId() {
    return this.myId;
  }

  public dispatchEventSingle<L extends EventListenerListeners = BroadcastEventsListeners, T extends keyof L = keyof L>(
    name: T,
    ...args: ArgumentTypes<L[T]>
  ) {
    super.dispatchEvent(name, ...args);
  }
}

const rootScope = new RootScope();
MOUNT_CLASS_TO.rootScope = rootScope;
export default rootScope;
