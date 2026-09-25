import { createPersistence, type Persistence } from '@v-gold/database';
import { PackagingService } from './packaging-service';

export class PackagingContainer {
  readonly packagingService: PackagingService;

  constructor(persistence: Persistence = createPersistence()) {
    this.packagingService = new PackagingService(persistence.packagingRepository);
  }
}

let packagingContainerInstance: PackagingContainer | null = null;

export function getPackagingContainer(): PackagingContainer {
  if (!packagingContainerInstance) {
    packagingContainerInstance = new PackagingContainer();
  }
  return packagingContainerInstance;
}

export function getPackagingService(): PackagingService {
  return getPackagingContainer().packagingService;
}
