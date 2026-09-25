import type { DesignSessionRepositoryPort, AiGatewayPort } from '@v-gold/core';
import { createPersistence, type Persistence } from '@v-gold/database';
import { AiGatewayClient } from '@v-gold/ai-gateway';
import { DesignSessionService } from './design-session-service';

class DesignSessionContainer {
  readonly sessionRepo: DesignSessionRepositoryPort;
  readonly aiGateway: AiGatewayPort;
  readonly designSessionService: DesignSessionService;

  constructor(
    persistence: Persistence = createPersistence(),
    aiGateway: AiGatewayPort = new AiGatewayClient()
  ) {
    this.sessionRepo = persistence.designSessionRepository;
    this.aiGateway = aiGateway;
    this.designSessionService = new DesignSessionService(this.sessionRepo, this.aiGateway);
  }
}

let designSessionContainerInstance: DesignSessionContainer | null = null;

export function getDesignSessionContainer(): DesignSessionContainer {
  if (!designSessionContainerInstance) {
    designSessionContainerInstance = new DesignSessionContainer();
  }
  return designSessionContainerInstance;
}

export function setDesignSessionContainer(container: DesignSessionContainer): void {
  designSessionContainerInstance = container;
}
