import type { TenantId } from '../domain/tenant/tenant.js';
import type { UserId } from '../domain/iam/user.js';
import type { CustomManufacturingRfq, RfqId } from '../domain/rfq/custom-manufacturing-rfq.js';

export interface RfqRepositoryPort {
  save(rfq: CustomManufacturingRfq): Promise<void>;
  findById(id: RfqId, tenantId?: TenantId): Promise<CustomManufacturingRfq | null>;
  listByParticipant(userId: UserId, tenantId: TenantId): Promise<CustomManufacturingRfq[]>;
  delete(id: RfqId, tenantId?: TenantId): Promise<void>;
  count(tenantId?: TenantId): Promise<number>;
}
