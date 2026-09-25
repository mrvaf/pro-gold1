import { Entity } from '../../common/entity.js';
import type { EntityId } from '../../common/id.js';
import { ok, err, type Result } from '../../common/result.js';
import type { TenantId } from '../tenant/tenant.js';
import type { UserId } from '../iam/user.js';
import type { Money } from '../finance/money.js';
import type { JewelryType } from '../catalog/jewelry-specification.js';
import type { MaterialType } from '../catalog/material-specification.js';
import {
  InvalidRfqStateTransitionError,
  RfqProposalNotFoundError,
} from './rfq-errors.js';
import type { RfqProposal, RfqProposalId } from './rfq-proposal.js';
import type { RfqMessage } from './rfq-message.js';

export type RfqId = EntityId<'Rfq'>;

export type RfqStatus =
  | 'DRAFT'
  | 'OPEN'          // Open for quotes from goldsmiths
  | 'PROPOSALS_RECEIVED'
  | 'ACCEPTED'      // Customer accepted a proposal, manufacturing underway
  | 'IN_PRODUCTION'
  | 'COMPLETED'
  | 'CANCELLED';

export interface RfqSpecification {
  readonly title: string;
  readonly description: string;
  readonly jewelryType: JewelryType;
  readonly targetMetal: MaterialType;
  readonly targetKarat?: number | undefined;
  readonly estimatedWeightGrams?: string | undefined;
  readonly referenceAssetUrl?: string | undefined;
  readonly targetBudget?: Money | undefined;
}

export interface RfqProps {
  readonly tenantId: TenantId;
  readonly customerId: UserId;
  readonly sellerId?: UserId | undefined;
  readonly assignedGoldsmithId?: UserId | undefined;
  readonly acceptedProposalId?: RfqProposalId | undefined;
  readonly specification: RfqSpecification;
  readonly status: RfqStatus;
  readonly proposals: RfqProposal[];
  readonly messages: RfqMessage[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateRfqInput {
  readonly tenantId: TenantId;
  readonly customerId: UserId;
  readonly sellerId?: UserId | undefined;
  readonly specification: RfqSpecification;
}

export class CustomManufacturingRfq extends Entity<RfqId> {
  private _status: RfqStatus;
  private _assignedGoldsmithId?: UserId | undefined;
  private _acceptedProposalId?: RfqProposalId | undefined;
  private readonly _proposals: RfqProposal[];
  private readonly _messages: RfqMessage[];
  private readonly _props: RfqProps;

  private constructor(id: RfqId, props: RfqProps) {
    super(id);
    this._status = props.status;
    this._assignedGoldsmithId = props.assignedGoldsmithId;
    this._acceptedProposalId = props.acceptedProposalId;
    this._proposals = [...props.proposals];
    this._messages = [...props.messages];
    this._props = props;
  }

  get tenantId(): TenantId {
    return this._props.tenantId;
  }

  get customerId(): UserId {
    return this._props.customerId;
  }

  get sellerId(): UserId | undefined {
    return this._props.sellerId;
  }

  get assignedGoldsmithId(): UserId | undefined {
    return this._assignedGoldsmithId;
  }

  get acceptedProposalId(): RfqProposalId | undefined {
    return this._acceptedProposalId;
  }

  get specification(): RfqSpecification {
    return this._props.specification;
  }

  get status(): RfqStatus {
    return this._status;
  }

  get proposals(): readonly RfqProposal[] {
    return Object.freeze([...this._proposals]);
  }

  get messages(): readonly RfqMessage[] {
    return Object.freeze([...this._messages]);
  }

  get createdAt(): Date {
    return this._props.createdAt;
  }

  get updatedAt(): Date {
    return this._props.updatedAt;
  }

  static create(id: RfqId, input: CreateRfqInput): CustomManufacturingRfq {
    const now = new Date();
    return new CustomManufacturingRfq(id, {
      tenantId: input.tenantId,
      customerId: input.customerId,
      sellerId: input.sellerId,
      specification: input.specification,
      status: 'OPEN',
      proposals: [],
      messages: [],
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(id: RfqId, props: RfqProps): CustomManufacturingRfq {
    return new CustomManufacturingRfq(id, props);
  }

  publish(): Result<void, InvalidRfqStateTransitionError> {
    if (this._status !== 'DRAFT') {
      return err(new InvalidRfqStateTransitionError(this._status, 'OPEN'));
    }
    this._status = 'OPEN';
    return ok(undefined);
  }

  addProposal(proposal: RfqProposal): Result<void, InvalidRfqStateTransitionError> {
    if (this._status !== 'OPEN' && this._status !== 'PROPOSALS_RECEIVED') {
      return err(new InvalidRfqStateTransitionError(this._status, 'PROPOSALS_RECEIVED'));
    }
    this._proposals.push(proposal);
    this._status = 'PROPOSALS_RECEIVED';
    return ok(undefined);
  }

  acceptProposal(proposalId: RfqProposalId): Result<void, InvalidRfqStateTransitionError | RfqProposalNotFoundError> {
    if (this._status !== 'OPEN' && this._status !== 'PROPOSALS_RECEIVED') {
      return err(new InvalidRfqStateTransitionError(this._status, 'ACCEPTED'));
    }

    const proposal = this._proposals.find((p) => p.id === proposalId);
    if (!proposal) {
      return err(new RfqProposalNotFoundError(proposalId));
    }

    // Accept target, reject other candidate proposals
    for (const p of this._proposals) {
      if (p.id === proposalId) {
        p.accept();
      } else {
        p.reject();
      }
    }

    this._acceptedProposalId = proposalId;
    this._assignedGoldsmithId = proposal.goldsmithId;
    this._status = 'ACCEPTED';
    return ok(undefined);
  }

  startProduction(): Result<void, InvalidRfqStateTransitionError> {
    if (this._status !== 'ACCEPTED') {
      return err(new InvalidRfqStateTransitionError(this._status, 'IN_PRODUCTION'));
    }
    this._status = 'IN_PRODUCTION';
    return ok(undefined);
  }

  complete(): Result<void, InvalidRfqStateTransitionError> {
    if (this._status !== 'IN_PRODUCTION') {
      return err(new InvalidRfqStateTransitionError(this._status, 'COMPLETED'));
    }
    this._status = 'COMPLETED';
    return ok(undefined);
  }

  cancel(): Result<void, InvalidRfqStateTransitionError> {
    if (this._status === 'COMPLETED') {
      return err(new InvalidRfqStateTransitionError(this._status, 'CANCELLED'));
    }
    this._status = 'CANCELLED';
    return ok(undefined);
  }

  addMessage(message: RfqMessage): void {
    this._messages.push(message);
  }

  toDto(): {
    id: string;
    tenantId: string;
    customerId: string;
    sellerId?: string | undefined;
    assignedGoldsmithId?: string | undefined;
    acceptedProposalId?: string | undefined;
    specification: {
      title: string;
      description: string;
      jewelryType: string;
      targetMetal: string;
      targetKarat?: number | undefined;
      estimatedWeightGrams?: string | undefined;
      referenceAssetUrl?: string | undefined;
      targetBudget?: string | undefined;
      currency?: string | undefined;
    };
    status: RfqStatus;
    proposals: ReturnType<RfqProposal['toDto']>[];
    messages: ReturnType<RfqMessage['toDto']>[];
    createdAt: string;
    updatedAt: string;
  } {
    return {
      id: this.id,
      tenantId: this.tenantId,
      customerId: this.customerId,
      sellerId: this.sellerId,
      assignedGoldsmithId: this._assignedGoldsmithId,
      acceptedProposalId: this._acceptedProposalId,
      specification: {
        title: this._props.specification.title,
        description: this._props.specification.description,
        jewelryType: this._props.specification.jewelryType,
        targetMetal: this._props.specification.targetMetal,
        targetKarat: this._props.specification.targetKarat,
        estimatedWeightGrams: this._props.specification.estimatedWeightGrams,
        referenceAssetUrl: this._props.specification.referenceAssetUrl,
        targetBudget: this._props.specification.targetBudget?.amount.toString(),
        currency: this._props.specification.targetBudget?.currency,
      },
      status: this._status,
      proposals: this._proposals.map((p) => p.toDto()),
      messages: this._messages.map((m) => m.toDto()),
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
