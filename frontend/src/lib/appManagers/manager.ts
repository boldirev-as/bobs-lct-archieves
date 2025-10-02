import type {RootScope} from '../rootScope';
import type {AppManagers} from './managers';
import {ActiveAccountNumber} from '../accounts/types';

export class AppManager {
  private accountNumber: ActiveAccountNumber;
  protected rootScope: RootScope;

  public clear: (init?: boolean) => void;

  public getAccountNumber() {
    return this.accountNumber;
  }

  public setManagersAndAccountNumber(managers: AppManagers, accountNumber: ActiveAccountNumber) {
    Object.assign(this, {...managers, accountNumber});
    // this.after();
  }
}
