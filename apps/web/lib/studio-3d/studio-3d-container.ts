import type {
  Studio3DAssetRepositoryPort,
  Studio3DStoragePort,
} from '@v-gold/core';
import { createPersistence, type Persistence } from '@v-gold/database';
import { Studio3DService } from './studio-3d-service';

class Studio3DContainer {
  readonly assetRepo: Studio3DAssetRepositoryPort;
  readonly storage: Studio3DStoragePort;
  readonly studio3dService: Studio3DService;

  constructor(persistence: Persistence = createPersistence()) {
    this.assetRepo = persistence.studio3dAssetRepository;
    this.storage = persistence.studio3dStorage;
    this.studio3dService = new Studio3DService(this.assetRepo, this.storage);
  }
}

let studio3dContainerInstance: Studio3DContainer | null = null;

export function getStudio3DContainer(): Studio3DContainer {
  if (!studio3dContainerInstance) {
    studio3dContainerInstance = new Studio3DContainer();
  }
  return studio3dContainerInstance;
}

export function setStudio3DContainer(container: Studio3DContainer): void {
  studio3dContainerInstance = container;
}
