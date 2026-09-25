import { Result } from '../common/result.js';
import { DigitalJewelryPassport } from '../domain/product/digital-jewelry-passport.js';

export interface DigitalJewelryPassportRepositoryPort {
  save(passport: DigitalJewelryPassport): Promise<Result<void, string>>;
  findById(tenantId: string, id: string): Promise<Result<DigitalJewelryPassport | null, string>>;
  findByProductId(tenantId: string, productId: string): Promise<Result<DigitalJewelryPassport | null, string>>;
  findBySerialNumber(tenantId: string, serialNumber: string): Promise<Result<DigitalJewelryPassport | null, string>>;
}
