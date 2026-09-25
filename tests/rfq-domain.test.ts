import { describe, it, expect } from 'vitest';
import {
  CustomManufacturingRfq,
  RfqProposal,
  MilestoneQuote,
  RfqMessage,
  Money,
  createEntityId,
  type RfqId,
  type RfqProposalId,
  type TenantId,
  type UserId,
  InvalidRfqStateTransitionError,
  RfqProposalNotFoundError,
} from '@v-gold/core';

describe('Stage 15 Custom Manufacturing & RFQ Domain Unit Tests', () => {
  const tenantId = createEntityId<TenantId>('tenant-rfq-unit');
  const customerId = createEntityId<UserId>('cust-1');
  const goldsmith1 = createEntityId<UserId>('gold-1');
  const goldsmith2 = createEntityId<UserId>('gold-2');
  const rfqId = createEntityId<RfqId>('rfq-1');

  it('manages RFQ lifecycle transitions: OPEN -> PROPOSALS_RECEIVED -> ACCEPTED -> IN_PRODUCTION -> COMPLETED', () => {
    const rfq = CustomManufacturingRfq.create(rfqId, {
      tenantId,
      customerId,
      specification: {
        title: 'Custom 18K Emerald Pendant',
        description: 'Bespoke hand-engraved design',
        jewelryType: 'PENDANT',
        targetMetal: 'GOLD',
        targetKarat: 18,
        estimatedWeightGrams: '12.5',
      },
    });

    expect(rfq.status).toBe('OPEN');

    // Submit Proposal 1
    const prop1 = new RfqProposal(createEntityId<RfqProposalId>('prop-1'), {
      rfqId: rfq.id,
      goldsmithId: goldsmith1,
      goldsmithName: 'Master Goldsmith Ali',
      estimatedDays: 14,
      totalQuote: Money.create('1200.00', 'USD').unwrap(),
      milestones: [
        MilestoneQuote.create({
          milestoneId: 'm1',
          title: 'Wax Model & Casting',
          description: 'Casting raw 18K gold body',
          targetDays: 5,
          costAmount: Money.create('500.00', 'USD').unwrap(),
        }),
        MilestoneQuote.create({
          milestoneId: 'm2',
          title: 'Setting & High Polish',
          description: 'Gem setting and final polish',
          targetDays: 9,
          costAmount: Money.create('700.00', 'USD').unwrap(),
        }),
      ],
      status: 'PENDING',
      submittedAt: new Date(),
    });

    const addPropRes = rfq.addProposal(prop1);
    expect(addPropRes.isOk).toBe(true);
    expect(rfq.status).toBe('PROPOSALS_RECEIVED');

    // Customer accepts proposal 1
    const acceptRes = rfq.acceptProposal(prop1.id);
    expect(acceptRes.isOk).toBe(true);
    expect(rfq.status).toBe('ACCEPTED');
    expect(rfq.assignedGoldsmithId).toBe(goldsmith1);
    expect(prop1.status).toBe('ACCEPTED');

    // Cannot transition directly from ACCEPTED to COMPLETED without production
    const badTransition = rfq.complete();
    expect(badTransition.isErr).toBe(true);
    if (badTransition.isErr) {
      expect(badTransition.error).toBeInstanceOf(InvalidRfqStateTransitionError);
    }

    // Start production
    expect(rfq.startProduction().isOk).toBe(true);
    expect(rfq.status).toBe('IN_PRODUCTION');

    // Complete production
    expect(rfq.complete().isOk).toBe(true);
    expect(rfq.status).toBe('COMPLETED');
  });

  it('adds in-band messaging between customer and goldsmith', () => {
    const rfq = CustomManufacturingRfq.create(rfqId, {
      tenantId,
      customerId,
      specification: {
        title: 'Bespoke Ring',
        description: 'Ring request',
        jewelryType: 'RING',
        targetMetal: 'GOLD',
      },
    });

    rfq.addMessage(
      RfqMessage.create({
        messageId: 'msg-1',
        senderId: customerId,
        senderRole: 'CUSTOMER',
        content: 'Can you engrave initials inside the band?',
        sentAt: new Date(),
      })
    );

    expect(rfq.messages.length).toBe(1);
    expect(rfq.messages[0]!.content).toContain('engrave initials');
  });
});
