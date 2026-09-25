import { Entity } from '../../common/entity.js';
import type { EntityId } from '../../common/id.js';
import type { Money } from '../finance/money.js';
import type { UserId } from '../iam/user.js';
import type { MilestoneQuote } from './milestone-quote.js';

export type RfqProposalId = EntityId<'RfqProposal'>;

export type RfqProposalStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface RfqProposalProps {
  readonly rfqId: string;
  readonly goldsmithId: UserId;
  readonly goldsmithName: string;
  readonly estimatedDays: number;
  readonly totalQuote: Money;
  readonly milestones: MilestoneQuote[];
  readonly notes?: string | undefined;
  readonly status: RfqProposalStatus;
  readonly submittedAt: Date;
}

export class RfqProposal extends Entity<RfqProposalId> {
  private _status: RfqProposalStatus;
  private readonly _props: RfqProposalProps;

  constructor(id: RfqProposalId, props: RfqProposalProps) {
    super(id);
    this._status = props.status;
    this._props = props;
  }

  get rfqId(): string {
    return this._props.rfqId;
  }

  get goldsmithId(): UserId {
    return this._props.goldsmithId;
  }

  get goldsmithName(): string {
    return this._props.goldsmithName;
  }

  get estimatedDays(): number {
    return this._props.estimatedDays;
  }

  get totalQuote(): Money {
    return this._props.totalQuote;
  }

  get milestones(): MilestoneQuote[] {
    return this._props.milestones;
  }

  get notes(): string | undefined {
    return this._props.notes;
  }

  get status(): RfqProposalStatus {
    return this._status;
  }

  get submittedAt(): Date {
    return this._props.submittedAt;
  }

  accept(): void {
    this._status = 'ACCEPTED';
  }

  reject(): void {
    this._status = 'REJECTED';
  }

  toDto(): {
    id: string;
    rfqId: string;
    goldsmithId: string;
    goldsmithName: string;
    estimatedDays: number;
    totalQuote: string;
    currency: string;
    milestones: ReturnType<MilestoneQuote['toDto']>[];
    notes?: string | undefined;
    status: RfqProposalStatus;
    submittedAt: string;
  } {
    return {
      id: this.id,
      rfqId: this.rfqId,
      goldsmithId: this.goldsmithId,
      goldsmithName: this.goldsmithName,
      estimatedDays: this.estimatedDays,
      totalQuote: this.totalQuote.amount.toString(),
      currency: this.totalQuote.currency,
      milestones: this.milestones.map((m) => m.toDto()),
      notes: this.notes,
      status: this._status,
      submittedAt: this.submittedAt.toISOString(),
    };
  }
}
