import { InvalidWorkspaceStateError } from './seller-os-errors.js';
import { ok, err, type Result } from '../../common/result.js';

export const WORKSPACE_STATUSES = ['ACTIVE', 'SUSPENDED', 'ARCHIVED'] as const;
export type WorkspaceStatus = (typeof WORKSPACE_STATUSES)[number];

const LEGAL_WORKSPACE_TRANSITIONS: Record<WorkspaceStatus, readonly WorkspaceStatus[]> = {
  ACTIVE: ['SUSPENDED', 'ARCHIVED'],
  SUSPENDED: ['ACTIVE', 'ARCHIVED'],
  ARCHIVED: [],
};

export class WorkspaceStateMachine {
  static canTransition(from: WorkspaceStatus, to: WorkspaceStatus): boolean {
    if (from === to) return true;
    return LEGAL_WORKSPACE_TRANSITIONS[from].includes(to);
  }

  static validateTransition(from: WorkspaceStatus, to: WorkspaceStatus): Result<void, InvalidWorkspaceStateError> {
    if (this.canTransition(from, to)) {
      return ok(undefined);
    }
    return err(
      new InvalidWorkspaceStateError(
        `Illegal workspace status transition from "${from}" to "${to}". Allowed transitions from "${from}": [${LEGAL_WORKSPACE_TRANSITIONS[from].join(', ')}].`
      )
    );
  }
}
