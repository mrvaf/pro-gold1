import { createPersistence } from '@v-gold/database';
import { TrustSafetyService } from './trust-safety-service';

let sharedTrustSafetyService: TrustSafetyService | null = null;

export function getTrustSafetyService(): TrustSafetyService {
  if (!sharedTrustSafetyService) {
    const persistence = createPersistence();
    sharedTrustSafetyService = new TrustSafetyService(persistence.trustSafetyRepository);
  }
  return sharedTrustSafetyService;
}
