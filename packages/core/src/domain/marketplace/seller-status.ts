import { InvalidSellerStateError } from './seller-errors.js';
import { ok, err, type Result } from '../../common/result.js';

export const SELLER_STATUSES = ['DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED'] as const;
export type SellerStatus = (typeof SELLER_STATUSES)[number];

const LEGAL_SELLER_TRANSITIONS: Record<SellerStatus, readonly SellerStatus[]> = {
  DRAFT: ['ACTIVE', 'ARCHIVED'],
  ACTIVE: ['SUSPENDED', 'ARCHIVED'],
  SUSPENDED: ['ACTIVE', 'ARCHIVED'],
  ARCHIVED: [],
};

export class SellerStateMachine {
  static canTransition(from: SellerStatus, to: SellerStatus): boolean {
    if (from === to) return true;
    return LEGAL_SELLER_TRANSITIONS[from].includes(to);
  }

  static validateTransition(from: SellerStatus, to: SellerStatus): Result<void, InvalidSellerStateError> {
    if (this.canTransition(from, to)) {
      return ok(undefined);
    }
    return err(
      new InvalidSellerStateError(
        `Illegal seller status transition from "${from}" to "${to}". Allowed transitions from "${from}": [${LEGAL_SELLER_TRANSITIONS[from].join(', ')}].`
      )
    );
  }
}
