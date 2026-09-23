import { BusinessRuleViolationError } from '../../common/errors.js';
import { err, ok, type Result } from '../../common/result.js';

export type InventoryStatus =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'SOLD'
  | 'DAMAGED'
  | 'LOST'
  | 'IN_TRANSIT';

export interface TransitionContext {
  reason?: string | undefined;
  reference?: string | undefined;
  isExplicitReturnWorkflow?: boolean | undefined;
  isRecoveryWorkflow?: boolean | undefined;
}

/**
 * Inventory State Machine.
 * Governs all status transitions for physical inventory pieces.
 * Enforces critical lifecycle invariants:
 * - SOLD cannot silently revert to AVAILABLE without an explicit return/reversal workflow.
 * - LOST items cannot be sold directly without formal recovery into inventory first.
 * - Inactive or terminal states cannot undergo ambiguous transitions.
 */
export class InventoryStateMachine {
  private static readonly ALLOWED_TRANSITIONS: Record<InventoryStatus, readonly InventoryStatus[]> = {
    AVAILABLE: ['RESERVED', 'SOLD', 'DAMAGED', 'LOST', 'IN_TRANSIT'],
    RESERVED: ['AVAILABLE', 'SOLD', 'DAMAGED', 'LOST'],
    SOLD: ['AVAILABLE'], // STRICT: Requires explicit return workflow flag
    DAMAGED: ['AVAILABLE', 'LOST'], // Repaired or written off as lost
    LOST: ['AVAILABLE', 'DAMAGED'], // Found intact or found damaged (CANNOT jump to SOLD or RESERVED)
    IN_TRANSIT: ['AVAILABLE', 'DAMAGED', 'LOST'],
  };

  /**
   * Validate whether a status transition is permitted under domain rules.
   */
  static validateTransition(
    currentStatus: InventoryStatus,
    targetStatus: InventoryStatus,
    context: TransitionContext = {}
  ): Result<void, BusinessRuleViolationError> {
    if (currentStatus === targetStatus) {
      return err(
        new BusinessRuleViolationError(
          `Inventory item is already in status "${currentStatus}". Redundant transition rejected.`
        )
      );
    }

    const allowed = this.ALLOWED_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(targetStatus)) {
      return err(
        new BusinessRuleViolationError(
          `Illegal inventory status transition from "${currentStatus}" to "${targetStatus}". Permitted transitions: [${allowed.join(', ')}].`
        )
      );
    }

    // Critical Invariant: SOLD -> AVAILABLE must never be silent or implicit
    if (currentStatus === 'SOLD' && targetStatus === 'AVAILABLE') {
      if (!context.isExplicitReturnWorkflow) {
        return err(
          new BusinessRuleViolationError(
            'Cannot transition item from SOLD to AVAILABLE without an explicit return workflow and audit reference.'
          )
        );
      }
      if (!context.reason || context.reason.trim().length === 0) {
        return err(
          new BusinessRuleViolationError(
            'Return workflow requires a documented business reason.'
          )
        );
      }
    }

    // Critical Invariant: LOST items cannot transition to SOLD
    if (currentStatus === 'LOST' && targetStatus === 'SOLD') {
      return err(
        new BusinessRuleViolationError(
          'A lost item cannot be directly sold. It must be recovered into inventory first.'
        )
      );
    }

    // Critical Invariant: Recovery from LOST
    if (currentStatus === 'LOST' && (targetStatus === 'AVAILABLE' || targetStatus === 'DAMAGED')) {
      if (!context.isRecoveryWorkflow) {
        return err(
          new BusinessRuleViolationError(
            'Recovering a LOST item requires an explicit recovery workflow.'
          )
        );
      }
    }

    return ok(undefined);
  }
}
