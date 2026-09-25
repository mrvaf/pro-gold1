import type {
  TryOnSessionRepositoryPort,
  Studio3DAssetRepositoryPort,
  Studio3DStoragePort,
} from '@v-gold/core';
import { createPersistence, type Persistence } from '@v-gold/database';
import { TryOnService } from './try-on-service';

class TryOnContainer {
  readonly tryOnRepo: TryOnSessionRepositoryPort;
  readonly assetRepo: Studio3DAssetRepositoryPort;
  readonly storage: Studio3DStoragePort;
  readonly tryOnService: TryOnService;

  constructor(persistence: Persistence = createPersistence()) {
    this.tryOnRepo = persistence.tryOnSessionRepository;
    this.assetRepo = persistence.studio3dAssetRepository;
    this.storage = persistence.studio3dStorage;
    this.tryOnService = new TryOnService(this.tryOnRepo, this.assetRepo, this.storage);
  }
}

let tryOnContainerInstance: TryOnContainer | null = null;

export function getTryOnContainer(): TryOnContainer {
  if (!tryOnContainerInstance) {
    tryOnContainerInstance = new TryOnContainer();
  }
  return tryOnContainerInstance;
}

export function setTryOnContainer(container: TryOnContainer): void {
  tryOnContainerInstance = container;
}
