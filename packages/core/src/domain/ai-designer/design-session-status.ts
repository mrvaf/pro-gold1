import { InvalidDesignSessionStateError } from './ai-designer-errors.js';
import { ok, err, type Result } from '../../common/result.js';

export const DESIGN_SESSION_STATUSES = ['ACTIVE', 'COMPLETED', 'ABANDONED'] as const;
export type DesignSessionStatus = (typeof DESIGN_SESSION_STATUSES)[number];

const LEGAL_DESIGN_SESSION_TRANSITIONS: Record<DesignSessionStatus, readonly DesignSessionStatus[]> = {
  ACTIVE: ['COMPLETED', 'ABANDONED'],
  COMPLETED: [],
  ABANDONED: [],
};

export class DesignSessionStateMachine {
  static canTransition(from: DesignSessionStatus, to: DesignSessionStatus): boolean {
    if (from === to) return true;
    return LEGAL_DESIGN_SESSION_TRANSITIONS[from].includes(to);
  }

  static validateTransition(
    from: DesignSessionStatus,
    to: DesignSessionStatus
  ): Result<void, InvalidDesignSessionStateError> {
    if (this.canTransition(from, to)) {
      return ok(undefined);
    }
    return err(
      new InvalidDesignSessionStateError(
        `Illegal design session status transition from "${from}" to "${to}". Allowed transitions from "${from}": [${LEGAL_DESIGN_SESSION_TRANSITIONS[from].join(', ')}].`
      )
    );
  }
}
