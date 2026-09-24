import { describe, expect, it } from 'vitest';
import {
  InventoryLocation,
  InventoryItem,
  InventoryMovement,
  InventoryStateMachine,
  SKU,
  Weight,
  GoldPurity,
  createEntityId,
  ActorReference,
  type TenantId,
  type StoreId,
  type ProductVariantId,
  type InventoryLocationId,
  BusinessRuleViolationError,
} from '@v-gold/core';
import {
  InMemoryInventoryLocationRepository,
  InMemoryInventoryItemRepository,
  InMemoryInventoryMovementRepository,
} from '@v-gold/database';
import { Decimal } from 'decimal.js';

describe('Stage 6: Inventory Domain & State Machine Invariants', () => {
  const tenantA = createEntityId<TenantId>('tenant_alpha_vault');
  const storeA = createEntityId<StoreId>('store_main_bazaar');
  const variantId = createEntityId<ProductVariantId>('var_solitaire_001');
  const sku = SKU.create('RNG-18K-DIA-01').unwrap();
  const actor = ActorReference.user('user_vault_keeper').unwrap();

  describe('InventoryLocation Entity', () => {
    it('creates location with valid code and tenant association', () => {
      const locRes = InventoryLocation.create({
        tenantId: tenantA,
        storeId: storeA,
        name: 'Main Secure Vault',
        code: 'MAIN_VAULT_01',
        type: 'VAULT',
        actor,
      });

      expect(locRes.isOk).toBe(true);
      const loc = locRes.unwrap();
      expect(loc.id).toBeDefined();
      expect(loc.tenantId).toBe(tenantA);
      expect(loc.storeId).toBe(storeA);
      expect(loc.code).toBe('MAIN_VAULT_01');
      expect(loc.status).toBe('ACTIVE');
    });

    it('rejects invalid location codes (spaces, lowercase, or special characters)', () => {
      const res = InventoryLocation.create({
        tenantId: tenantA,
        name: 'Invalid Loc',
        code: 'bad code with spaces!',
        type: 'VAULT',
      });
      expect(res.isErr).toBe(true);
    });
  });

  describe('InventoryItem Intake & Physical Invariants', () => {
    const locId = createEntityId<InventoryLocationId>('loc_vault_01');

    it('creates InventoryItem through intake factory and produces initial INTAKE movement', () => {
      const gross = Weight.fromGrams('10.500000').unwrap();
      const gold = Weight.fromGrams('10.000000').unwrap();
      const purity = GoldPurity.K18;

      const intakeRes = InventoryItem.intake({
        tenantId: tenantA,
        storeId: storeA,
        productVariantId: variantId,
        sku,
        serialNumber: 'SN-2026-9901',
        barcode: 'BAR-9901',
        locationId: locId,
        grossWeight: gross,
        goldWeight: gold,
        purity,
        passportRef: 'PASSPORT-REF-001',
        actor,
        notes: 'Initial bullion intake',
      });

      expect(intakeRes.isOk).toBe(true);
      const { item, movement } = intakeRes.unwrap();

      expect(item.id).toBeDefined();
      expect(item.status).toBe('AVAILABLE');
      expect(item.quantity.toString()).toBe('1');
      expect(item.serialNumber).toBe('SN-2026-9901');
      expect(item.identity.id).toBe(item.id);
      expect(item.identity.sku).toBe(sku.value);

      // Verify associated INTAKE movement
      expect(movement.id).toBeDefined();
      expect(movement.movementType).toBe('INTAKE');
      expect(movement.toLocationId).toBe(locId);
      expect(movement.fromStatus).toBe('AVAILABLE');
      expect(movement.toStatus).toBe('AVAILABLE');
      expect(movement.actor.actorId).toBe('user_vault_keeper');
    });

    it('rejects intake where gross weight is less than net gold weight', () => {
      const subGross = Weight.fromGrams('9.500000').unwrap();
      const gold = Weight.fromGrams('10.000000').unwrap();

      const intakeRes = InventoryItem.intake({
        tenantId: tenantA,
        productVariantId: variantId,
        sku,
        locationId: locId,
        grossWeight: subGross, // Invalid: 9.5g < 10.0g
        goldWeight: gold,
        purity: GoldPurity.K18,
        actor,
      });

      expect(intakeRes.isErr).toBe(true);
    });
  });

  describe('Inventory State Machine Transitions', () => {
    const loc1 = createEntityId<InventoryLocationId>('loc_vault');
    const loc2 = createEntityId<InventoryLocationId>('loc_display');

    const makeItem = () => {
      return InventoryItem.intake({
        tenantId: tenantA,
        productVariantId: variantId,
        sku,
        serialNumber: 'SN-TRANS-TEST',
        locationId: loc1,
        grossWeight: Weight.fromGrams('5.0').unwrap(),
        goldWeight: Weight.fromGrams('5.0').unwrap(),
        purity: GoldPurity.K18,
        actor,
      }).unwrap().item;
    };

    it('permits valid physical location transfer (AVAILABLE state)', () => {
      const item = makeItem();
      expect(item.locationId).toBe(loc1);

      const transRes = item.transfer(loc2, actor, 'TRANSFER-SLIP-01');
      expect(transRes.isOk).toBe(true);
      const movement = transRes.unwrap();

      expect(item.locationId).toBe(loc2);
      expect(movement.movementType).toBe('TRANSFER');
      expect(movement.fromLocationId).toBe(loc1);
      expect(movement.toLocationId).toBe(loc2);
    });

    it('handles reservation lifecycle: AVAILABLE -> RESERVED -> RELEASE_RESERVATION -> AVAILABLE', () => {
      const item = makeItem();

      // Reserve
      const resMove = item.reserve(actor, 'ORDER-HOLD-101');
      expect(resMove.isOk).toBe(true);
      expect(item.status).toBe('RESERVED');
      expect(resMove.unwrap().movementType).toBe('RESERVATION');

      // Cannot reserve an already reserved item
      const doubleRes = item.reserve(actor);
      expect(doubleRes.isErr).toBe(true);

      // Release reservation
      const releaseMove = item.releaseReservation(actor, 'HOLD-EXPIRED');
      expect(releaseMove.isOk).toBe(true);
      expect(item.status).toBe('AVAILABLE');
      expect(releaseMove.unwrap().movementType).toBe('RELEASE_RESERVATION');
    });

    it('handles sales lifecycle: AVAILABLE -> SOLD, and prevents silent revert', () => {
      const item = makeItem();

      // Mark sold
      const saleMove = item.markAsSold(actor, 'RECEIPT-9988');
      expect(saleMove.isOk).toBe(true);
      expect(item.status).toBe('SOLD');
      expect(saleMove.unwrap().movementType).toBe('SALE');

      // Invariant: Cannot relocate a sold item
      const transferAttempt = item.transfer(loc2, actor);
      expect(transferAttempt.isErr).toBe(true);

      // Invariant: Sold item CANNOT silently become AVAILABLE without explicit return workflow
      const rawTransitionCheck = InventoryStateMachine.validateTransition('SOLD', 'AVAILABLE', {
        isExplicitReturnWorkflow: false,
      });
      expect(rawTransitionCheck.isErr).toBe(true);

      // Formal return workflow succeeds with documented reason
      const returnRes = item.returnFromSold(actor, 'Customer returned under 7-day guarantee policy', loc1);
      expect(returnRes.isOk).toBe(true);
      expect(item.status).toBe('AVAILABLE');
      expect(returnRes.unwrap().movementType).toBe('RETURN');
    });

    it('enforces lost item invariants: LOST item cannot be sold directly', () => {
      const item = makeItem();

      // Mark as lost
      const lostRes = item.markAsLost(actor, 'Discrepancy detected during daily audit');
      expect(lostRes.isOk).toBe(true);
      expect(item.status).toBe('LOST');

      // Attempt to sell lost item must be strictly rejected
      const directSaleAttempt = item.markAsSold(actor);
      expect(directSaleAttempt.isErr).toBe(true);

      // State machine validation also directly rejects LOST -> SOLD
      const check = InventoryStateMachine.validateTransition('LOST', 'SOLD');
      expect(check.isErr).toBe(true);

      // Must be formally recovered into inventory
      const recoverRes = item.recoverLost(actor, loc1, 'Found in secondary showcase safe');
      expect(recoverRes.isOk).toBe(true);
      expect(item.status).toBe('AVAILABLE');
    });

    it('enforces append-only nature of movements in repository', async () => {
      const movRepo = new InMemoryInventoryMovementRepository();
      const item = makeItem();

      const mov1 = item.reserve(actor, 'REF-1').unwrap();
      const mov2 = item.releaseReservation(actor, 'REF-2').unwrap();

      await movRepo.record(mov1);
      await movRepo.record(mov2);

      const list = await movRepo.listByItemId(item.id, tenantA);
      expect(list.length).toBe(2);
      expect(list.map((m) => m.movementType)).toContain('RESERVATION');
      expect(list.map((m) => m.movementType)).toContain('RELEASE_RESERVATION');

      // Total count in tenant
      expect(await movRepo.count(tenantA)).toBe(2);
    });
  });
});
