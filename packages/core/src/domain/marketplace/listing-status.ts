import { InvalidListingStateError } from './seller-errors.js';
import { ok, err, type Result } from '../../common/result.js';

export const LISTING_STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const LISTING_VISIBILITIES = ['PUBLIC', 'UNLISTED', 'HIDDEN'] as const;
export type ListingVisibility = (typeof LISTING_VISIBILITIES)[number];

const LEGAL_LISTING_TRANSITIONS: Record<ListingStatus, readonly ListingStatus[]> = {
  DRAFT: ['ACTIVE', 'ARCHIVED'],
  ACTIVE: ['PAUSED', 'ARCHIVED'],
  PAUSED: ['ACTIVE', 'ARCHIVED'],
  ARCHIVED: [],
};

export class ListingStateMachine {
  static canTransition(from: ListingStatus, to: ListingStatus): boolean {
    if (from === to) return true;
    return LEGAL_LISTING_TRANSITIONS[from].includes(to);
  }

  static validateTransition(from: ListingStatus, to: ListingStatus): Result<void, InvalidListingStateError> {
    if (this.canTransition(from, to)) {
      return ok(undefined);
    }
    return err(
      new InvalidListingStateError(
        `Illegal listing status transition from "${from}" to "${to}". Allowed transitions from "${from}": [${LEGAL_LISTING_TRANSITIONS[from].join(', ')}].`
      )
    );
  }
}
