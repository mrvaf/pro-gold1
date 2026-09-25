import { InvalidConceptStateError } from './concept-errors.js';
import { ok, err, type Result } from '../../common/result.js';

export const DESIGN_CONCEPT_STATUSES = [
  'PENDING',
  'GENERATED',
  'FAILED',
  'APPROVED',
  'REJECTED',
] as const;
export type DesignConceptStatus = (typeof DESIGN_CONCEPT_STATUSES)[number];

const LEGAL_CONCEPT_TRANSITIONS: Record<DesignConceptStatus, readonly DesignConceptStatus[]> = {
  PENDING: ['GENERATED', 'FAILED'],
  GENERATED: ['APPROVED', 'REJECTED'],
  FAILED: [],
  APPROVED: [],
  REJECTED: [],
};

export class ConceptStateMachine {
  static canTransition(from: DesignConceptStatus, to: DesignConceptStatus): boolean {
    if (from === to) return true;
    return LEGAL_CONCEPT_TRANSITIONS[from].includes(to);
  }

  static validateTransition(
    from: DesignConceptStatus,
    to: DesignConceptStatus
  ): Result<void, InvalidConceptStateError> {
    if (this.canTransition(from, to)) {
      return ok(undefined);
    }
    return err(
      new InvalidConceptStateError(
        `Illegal design concept status transition from "${from}" to "${to}". Allowed transitions from "${from}": [${LEGAL_CONCEPT_TRANSITIONS[from].join(', ')}].`
      )
    );
  }
}
