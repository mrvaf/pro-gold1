import type {
  VectorSearchIndexPort,
  VisualFeatureExtractorPort,
  ProductRepositoryPort,
} from '@v-gold/core';
import { createPersistence, type Persistence } from '@v-gold/database';
import { MockVisualFeatureExtractorAdapter } from '@v-gold/ai-gateway';
import { VisualSearchService } from './visual-search-service';

class VisualSearchContainer {
  readonly vectorIndex: VectorSearchIndexPort;
  readonly featureExtractor: VisualFeatureExtractorPort;
  readonly productRepo: ProductRepositoryPort;
  readonly visualSearchService: VisualSearchService;

  constructor(
    persistence: Persistence = createPersistence(),
    featureExtractor: VisualFeatureExtractorPort = new MockVisualFeatureExtractorAdapter()
  ) {
    this.vectorIndex = persistence.vectorSearchIndexRepository;
    this.productRepo = persistence.productRepository;
    this.featureExtractor = featureExtractor;
    this.visualSearchService = new VisualSearchService(
      this.vectorIndex,
      this.featureExtractor,
      this.productRepo
    );
  }
}

let visualSearchContainerInstance: VisualSearchContainer | null = null;

export function getVisualSearchContainer(): VisualSearchContainer {
  if (!visualSearchContainerInstance) {
    visualSearchContainerInstance = new VisualSearchContainer();
  }
  return visualSearchContainerInstance;
}

export function setVisualSearchContainer(container: VisualSearchContainer): void {
  visualSearchContainerInstance = container;
}
