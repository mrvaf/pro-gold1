import { createPersistence, type Persistence } from '@v-gold/database';
import { ContentStudioService } from './content-studio-service';

export class ContentStudioContainer {
  readonly contentStudioService: ContentStudioService;

  constructor(persistence: Persistence = createPersistence()) {
    this.contentStudioService = new ContentStudioService(
      persistence.contentStudioRepository
    );
  }
}

let contentStudioContainerInstance: ContentStudioContainer | null = null;

export function getContentStudioContainer(): ContentStudioContainer {
  if (!contentStudioContainerInstance) {
    contentStudioContainerInstance = new ContentStudioContainer();
  }
  return contentStudioContainerInstance;
}

export function getContentStudioService(): ContentStudioService {
  return getContentStudioContainer().contentStudioService;
}
