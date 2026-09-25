import { Result, ok } from '@v-gold/core';
import { DigitalJewelryPassport } from '@v-gold/core';
import { DigitalJewelryPassportRepositoryPort } from '@v-gold/core';

export class InMemoryDigitalJewelryPassportRepository implements DigitalJewelryPassportRepositoryPort {
  private readonly store = new Map<string, DigitalJewelryPassport>();

  private key(tenantId: string, id: string): string {
    return `${tenantId}::${id}`;
  }

  async save(passport: DigitalJewelryPassport): Promise<Result<void, string>> {
    this.store.set(this.key(passport.tenantId, passport.id), passport);
    return ok(undefined);
  }

  async findById(tenantId: string, id: string): Promise<Result<DigitalJewelryPassport | null, string>> {
    const item = this.store.get(this.key(tenantId, id));
    return ok(item || null);
  }

  async findByProductId(tenantId: string, productId: string): Promise<Result<DigitalJewelryPassport | null, string>> {
    for (const item of this.store.values()) {
      if (item.tenantId === tenantId && item.productId === productId) {
        return ok(item);
      }
    }
    return ok(null);
  }

  async findBySerialNumber(tenantId: string, serialNumber: string): Promise<Result<DigitalJewelryPassport | null, string>> {
    for (const item of this.store.values()) {
      if (item.tenantId === tenantId && item.serialNumber === serialNumber) {
        return ok(item);
      }
    }
    return ok(null);
  }
}
