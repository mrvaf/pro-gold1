import { describe, expect, it } from 'vitest';
import {
  SellerWorkspace,
  WorkspaceStateMachine,
  createEntityId,
  type TenantId,
  type SellerProfileId,
  type StoreId,
  ActorReference,
} from '@v-gold/core';

describe('Seller OS Domain Model & Workspace Lifecycle', () => {
  const tenantId = createEntityId<TenantId>('tenant_damas_tehran');
  const sellerProfileId = createEntityId<SellerProfileId>('seller_damas_atelier');
  const storeId = createEntityId<StoreId>('store_grand_bazaar_01');

  describe('SellerWorkspace Entity Creation & Validation', () => {
    it('creates a valid SellerWorkspace with default ACTIVE status', () => {
      const res = SellerWorkspace.create({
        tenantId,
        sellerProfileId,
        storeId,
        name: 'Damas Grand Bazaar Workspace',
        settings: { autoArchiveAfterDays: 90 },
      });

      expect(res.isOk).toBe(true);
      const ws = res.unwrap();
      expect(ws.id).toBeDefined();
      expect(ws.tenantId).toBe(tenantId);
      expect(ws.sellerProfileId).toBe(sellerProfileId);
      expect(ws.storeId).toBe(storeId);
      expect(ws.name).toBe('Damas Grand Bazaar Workspace');
      expect(ws.status).toBe('ACTIVE');
      expect(ws.isActive).toBe(true);
      expect(ws.settings).toEqual({ autoArchiveAfterDays: 90 });
      expect(ws.audit.createdAt).toBeInstanceOf(Date);
    });

    it('rejects creation when tenantId is empty', () => {
      const res = SellerWorkspace.create({
        tenantId: '' as any,
        sellerProfileId,
        name: 'Invalid Workspace',
      });

      expect(res.isErr).toBe(true);
      expect((res as any).error.code).toBe('VALIDATION_ERROR');
      expect((res as any).error.message).toContain('tenantId');
    });

    it('rejects creation when sellerProfileId is empty', () => {
      const res = SellerWorkspace.create({
        tenantId,
        sellerProfileId: '' as any,
        name: 'Invalid Workspace',
      });

      expect(res.isErr).toBe(true);
      expect((res as any).error.code).toBe('VALIDATION_ERROR');
      expect((res as any).error.message).toContain('sellerProfileId');
    });

    it('rejects creation when name is too short', () => {
      const res = SellerWorkspace.create({
        tenantId,
        sellerProfileId,
        name: 'A',
      });

      expect(res.isErr).toBe(true);
      expect((res as any).error.code).toBe('VALIDATION_ERROR');
      expect((res as any).error.message).toContain('at least 2 characters');
    });

    it('reconstitutes an existing SellerWorkspace cleanly', () => {
      const ws = SellerWorkspace.create({
        tenantId,
        sellerProfileId,
        name: 'Persian Goldsmith Hub',
      }).unwrap();

      const reconstituted = SellerWorkspace.reconstitute(
        ws.id,
        ws.tenantId,
        ws.sellerProfileId,
        ws.storeId,
        ws.name,
        ws.status,
        ws.settings,
        ws.audit
      );

      expect(reconstituted.id).toBe(ws.id);
      expect(reconstituted.name).toBe(ws.name);
      expect(reconstituted.status).toBe('ACTIVE');
    });
  });

  describe('Workspace State Machine & Lifecycle Invariants', () => {
    it('allows ACTIVE -> SUSPENDED -> ACTIVE cycle', () => {
      const ws = SellerWorkspace.create({
        tenantId,
        sellerProfileId,
        name: 'Operational Workspace',
      }).unwrap();

      expect(ws.status).toBe('ACTIVE');

      const suspRes = ws.suspend(ActorReference.system(), 'Routine compliance audit');
      expect(suspRes.isOk).toBe(true);
      expect(ws.status).toBe('SUSPENDED');
      expect(ws.isActive).toBe(false);

      const reinRes = ws.reinstate(ActorReference.system());
      expect(reinRes.isOk).toBe(true);
      expect(ws.status).toBe('ACTIVE');
      expect(ws.isActive).toBe(true);
    });

    it('allows ACTIVE -> ARCHIVED transition', () => {
      const ws = SellerWorkspace.create({
        tenantId,
        sellerProfileId,
        name: 'Operational Workspace',
      }).unwrap();

      const archRes = ws.archive(ActorReference.system(), 'Merchant closed');
      expect(archRes.isOk).toBe(true);
      expect(ws.status).toBe('ARCHIVED');
      expect(ws.isActive).toBe(false);
    });

    it('allows SUSPENDED -> ARCHIVED transition', () => {
      const ws = SellerWorkspace.create({
        tenantId,
        sellerProfileId,
        name: 'Operational Workspace',
      }).unwrap();

      ws.suspend(ActorReference.system());
      const archRes = ws.archive(ActorReference.system(), 'Permanent revocation');
      expect(archRes.isOk).toBe(true);
      expect(ws.status).toBe('ARCHIVED');
    });

    it('strictly forbids transitions out of ARCHIVED (terminal state)', () => {
      const ws = SellerWorkspace.create({
        tenantId,
        sellerProfileId,
        name: 'Operational Workspace',
      }).unwrap();

      ws.archive(ActorReference.system());
      expect(ws.status).toBe('ARCHIVED');

      const reinRes = ws.reinstate(ActorReference.system());
      expect(reinRes.isErr).toBe(true);
      expect((reinRes as any).error.code).toBe('INVALID_WORKSPACE_STATE');

      const suspRes = ws.suspend(ActorReference.system());
      expect(suspRes.isErr).toBe(true);
      expect((suspRes as any).error.code).toBe('INVALID_WORKSPACE_STATE');
    });

    it('WorkspaceStateMachine correctly validates transition rules', () => {
      expect(WorkspaceStateMachine.canTransition('ACTIVE', 'SUSPENDED')).toBe(true);
      expect(WorkspaceStateMachine.canTransition('ACTIVE', 'ARCHIVED')).toBe(true);
      expect(WorkspaceStateMachine.canTransition('SUSPENDED', 'ACTIVE')).toBe(true);
      expect(WorkspaceStateMachine.canTransition('SUSPENDED', 'ARCHIVED')).toBe(true);
      expect(WorkspaceStateMachine.canTransition('ARCHIVED', 'ACTIVE')).toBe(false);
      expect(WorkspaceStateMachine.canTransition('ARCHIVED', 'SUSPENDED')).toBe(false);
    });
  });

  describe('Workspace Entity Updates & Serialization', () => {
    it('updates name and touches audit timestamp', async () => {
      const ws = SellerWorkspace.create({
        tenantId,
        sellerProfileId,
        name: 'Old Workspace Name',
      }).unwrap();

      const initialUpdated = ws.audit.updatedAt;
      await new Promise((resolve) => setTimeout(resolve, 2));

      const updateRes = ws.updateName('New Official Workspace Name');
      expect(updateRes.isOk).toBe(true);
      expect(ws.name).toBe('New Official Workspace Name');
      expect(ws.audit.updatedAt.getTime()).toBeGreaterThanOrEqual(initialUpdated.getTime());
    });

    it('rejects updating name to invalid length', () => {
      const ws = SellerWorkspace.create({
        tenantId,
        sellerProfileId,
        name: 'Valid Name',
      }).unwrap();

      const errRes = ws.updateName('x');
      expect(errRes.isErr).toBe(true);
      expect((errRes as any).error.code).toBe('VALIDATION_ERROR');
    });

    it('updates settings and storeId', () => {
      const ws = SellerWorkspace.create({
        tenantId,
        sellerProfileId,
        name: 'Workspace Name',
      }).unwrap();

      ws.updateSettings({ theme: 'dark', notificationsEnabled: true });
      expect(ws.settings).toEqual({ theme: 'dark', notificationsEnabled: true });

      const newStoreId = createEntityId<StoreId>('store_tabriz_02');
      ws.setStoreId(newStoreId);
      expect(ws.storeId).toBe(newStoreId);

      ws.setStoreId(undefined);
      expect(ws.storeId).toBeUndefined();
    });

    it('serializes to clean DTO', () => {
      const ws = SellerWorkspace.create({
        tenantId,
        sellerProfileId,
        storeId,
        name: 'Workspace DTO Test',
        settings: { notify: true },
      }).unwrap();

      const dto = ws.toDto();
      expect(dto.id).toBe(ws.id);
      expect(dto.tenantId).toBe(tenantId);
      expect(dto.sellerProfileId).toBe(sellerProfileId);
      expect(dto.storeId).toBe(storeId);
      expect(dto.name).toBe('Workspace DTO Test');
      expect(dto.status).toBe('ACTIVE');
      expect(dto.settings).toEqual({ notify: true });
      expect(dto.createdAt).toBeDefined();
      expect(dto.updatedAt).toBeDefined();
    });
  });
});
