import type {
  DesignConceptRepositoryPort,
  DesignSessionRepositoryPort,
  AiGatewayPort,
} from '@v-gold/core';
import { createPersistence, type Persistence } from '@v-gold/database';
import { AiGatewayClient } from '@v-gold/ai-gateway';
import { DesignConceptService } from './design-concept-service';

class DesignConceptContainer {
  readonly conceptRepo: DesignConceptRepositoryPort;
  readonly sessionRepo: DesignSessionRepositoryPort;
  readonly aiGateway: AiGatewayPort;
  readonly designConceptService: DesignConceptService;

  constructor(
    persistence: Persistence = createPersistence(),
    aiGateway: AiGatewayPort = new AiGatewayClient()
  ) {
    this.conceptRepo = persistence.designConceptRepository;
    this.sessionRepo = persistence.designSessionRepository;
    this.aiGateway = aiGateway;
    this.designConceptService = new DesignConceptService(
      this.conceptRepo,
      this.sessionRepo,
      this.aiGateway
    );
  }
}

let designConceptContainerInstance: DesignConceptContainer | null = null;

export function getDesignConceptContainer(): DesignConceptContainer {
  if (!designConceptContainerInstance) {
    designConceptContainerInstance = new DesignConceptContainer();
  }
  return designConceptContainerInstance;
}

export function setDesignConceptContainer(container: DesignConceptContainer): void {
  designConceptContainerInstance = container;
}
