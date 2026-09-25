import {
  type TenantId,
  type UserId,
  createEntityId,
  type Result,
  ok,
  err,
  DomainError,
  CustomManufacturingRfq,
  type RfqId,
  type RfqRepositoryPort,
  RfqProposal,
  type RfqProposalId,
  MilestoneQuote,
  RfqMessage,
  Money,
  type CurrencyCode,
  type JewelryType,
  type MaterialType,
  RfqNotFoundError,
  UnauthorizedRfqParticipantError,
} from '@v-gold/core';

export interface CreateRfqCommand {
  tenantId: TenantId;
  customerId: UserId;
  sellerId?: UserId | undefined;
  title: string;
  description: string;
  jewelryType: JewelryType;
  targetMetal: MaterialType;
  targetKarat?: number | undefined;
  estimatedWeightGrams?: string | undefined;
  referenceAssetUrl?: string | undefined;
  targetBudgetAmount?: string | undefined;
  currency?: CurrencyCode | undefined;
}

export interface SubmitProposalCommand {
  tenantId: TenantId;
  rfqId: RfqId;
  goldsmithId: UserId;
  goldsmithName: string;
  estimatedDays: number;
  totalQuoteAmount: string;
  currency: CurrencyCode;
  notes?: string | undefined;
  milestones: Array<{
    milestoneId: string;
    title: string;
    description: string;
    targetDays: number;
    costAmount: string;
  }>;
}

export interface PostMessageCommand {
  tenantId: TenantId;
  rfqId: RfqId;
  senderId: UserId;
  senderRole: 'CUSTOMER' | 'SELLER' | 'GOLDSMITH';
  content: string;
}

export class RfqService {
  constructor(private readonly rfqRepo: RfqRepositoryPort) {}

  async createRfq(cmd: CreateRfqCommand): Promise<Result<CustomManufacturingRfq, DomainError>> {
    const rfqId = createEntityId<RfqId>(`rfq_${Date.now()}`);

    const targetBudget =
      cmd.targetBudgetAmount && cmd.currency
        ? Money.create(cmd.targetBudgetAmount, cmd.currency).unwrap()
        : undefined;

    const rfq = CustomManufacturingRfq.create(rfqId, {
      tenantId: cmd.tenantId,
      customerId: cmd.customerId,
      sellerId: cmd.sellerId,
      specification: {
        title: cmd.title,
        description: cmd.description,
        jewelryType: cmd.jewelryType,
        targetMetal: cmd.targetMetal,
        targetKarat: cmd.targetKarat,
        estimatedWeightGrams: cmd.estimatedWeightGrams,
        referenceAssetUrl: cmd.referenceAssetUrl,
        targetBudget,
      },
    });

    await this.rfqRepo.save(rfq);
    return ok(rfq);
  }

  async submitProposal(cmd: SubmitProposalCommand): Promise<Result<RfqProposal, DomainError>> {
    const rfq = await this.rfqRepo.findById(cmd.rfqId, cmd.tenantId);
    if (!rfq) {
      return err(new RfqNotFoundError(cmd.rfqId));
    }

    const proposalId = createEntityId<RfqProposalId>(`prop_${Date.now()}`);
    const milestones = cmd.milestones.map((m) =>
      MilestoneQuote.create({
        milestoneId: m.milestoneId,
        title: m.title,
        description: m.description,
        targetDays: m.targetDays,
        costAmount: Money.create(m.costAmount, cmd.currency).unwrap(),
      })
    );

    const proposal = new RfqProposal(proposalId, {
      rfqId: cmd.rfqId,
      goldsmithId: cmd.goldsmithId,
      goldsmithName: cmd.goldsmithName,
      estimatedDays: cmd.estimatedDays,
      totalQuote: Money.create(cmd.totalQuoteAmount, cmd.currency).unwrap(),
      milestones,
      notes: cmd.notes,
      status: 'PENDING',
      submittedAt: new Date(),
    });

    const addRes = rfq.addProposal(proposal);
    if (addRes.isErr) {
      return err(addRes.error);
    }

    await this.rfqRepo.save(rfq);
    return ok(proposal);
  }

  async acceptProposal(
    rfqId: RfqId,
    proposalId: RfqProposalId,
    customerId: UserId,
    tenantId: TenantId
  ): Promise<Result<CustomManufacturingRfq, DomainError>> {
    const rfq = await this.rfqRepo.findById(rfqId, tenantId);
    if (!rfq) {
      return err(new RfqNotFoundError(rfqId));
    }

    if (rfq.customerId !== customerId) {
      return err(new UnauthorizedRfqParticipantError(customerId, rfqId));
    }

    const acceptRes = rfq.acceptProposal(proposalId);
    if (acceptRes.isErr) {
      return err(acceptRes.error);
    }

    await this.rfqRepo.save(rfq);
    return ok(rfq);
  }

  async postMessage(cmd: PostMessageCommand): Promise<Result<RfqMessage, DomainError>> {
    const rfq = await this.rfqRepo.findById(cmd.rfqId, cmd.tenantId);
    if (!rfq) {
      return err(new RfqNotFoundError(cmd.rfqId));
    }

    const message = RfqMessage.create({
      messageId: `msg_${Date.now()}`,
      senderId: cmd.senderId,
      senderRole: cmd.senderRole,
      content: cmd.content,
      sentAt: new Date(),
    });

    rfq.addMessage(message);
    await this.rfqRepo.save(rfq);
    return ok(message);
  }

  async getRfq(id: RfqId, tenantId: TenantId): Promise<Result<CustomManufacturingRfq, DomainError>> {
    const rfq = await this.rfqRepo.findById(id, tenantId);
    if (!rfq) {
      return err(new RfqNotFoundError(id));
    }
    return ok(rfq);
  }
}
