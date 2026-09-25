import {
  type DesignConceptRepositoryPort,
  type DesignSessionRepositoryPort,
  type AiGatewayPort,
  DesignConcept,
  DesignConceptNotFoundError,
  DesignSessionNotFoundError,
  createEntityId,
  type DesignConceptId,
  type DesignSessionId,
  type TenantId,
  ActorReference,
  ValidationError,
  ok,
  err,
  type Result,
  type DomainError,
} from '@v-gold/core';

export interface GenerateConceptCommand {
  tenantId: string;
  sessionId: string;
  idempotencyKey: string;
  promptRefinement?: string;
  actorId?: string;
}

export interface UpdateConceptStatusCommand {
  tenantId: string;
  sessionId: string;
  conceptId: string;
  action: 'APPROVE' | 'REJECT';
  actorId?: string;
}

export class DesignConceptService {
  constructor(
    private readonly conceptRepo: DesignConceptRepositoryPort,
    private readonly sessionRepo: DesignSessionRepositoryPort,
    private readonly aiGateway: AiGatewayPort
  ) {}

  async generateConcept(
    cmd: GenerateConceptCommand
  ): Promise<Result<DesignConcept, DomainError>> {
    const tenantId = createEntityId<TenantId>(cmd.tenantId);
    const sessionId = createEntityId<DesignSessionId>(cmd.sessionId);

    // 1. Check idempotency: if concept already exists for (tenantId, sessionId, idempotencyKey), return it
    const existing = await this.conceptRepo.findByIdempotencyKey(
      tenantId,
      sessionId,
      cmd.idempotencyKey
    );
    if (existing) {
      return ok(existing);
    }

    // 2. Load session and verify existence
    const session = await this.sessionRepo.findById(sessionId, tenantId);
    if (!session) {
      return err(new DesignSessionNotFoundError(cmd.sessionId));
    }

    const actor = cmd.actorId
      ? ActorReference.user(cmd.actorId).unwrapOr(ActorReference.system())
      : ActorReference.system();

    const promptRefinement =
      cmd.promptRefinement?.trim() ||
      `Jewelry design based on session attributes: ${session.title}`;

    // 3. Delegate to AI Gateway for concept proposal
    if (!this.aiGateway.generateConcept) {
      return err(new ValidationError('AI Gateway does not support concept generation.'));
    }

    const aiRes = await this.aiGateway.generateConcept({
      promptRefinement,
      groundedAttributes: session.extractedAttributes,
      idempotencyKey: cmd.idempotencyKey,
    });

    if (aiRes.isErr) {
      return err(aiRes.error);
    }

    const aiVal = aiRes.value;

    // 4. Create grounded concept entity
    const conceptRes = DesignConcept.create({
      tenantId,
      sessionId,
      idempotencyKey: cmd.idempotencyKey,
      title: aiVal.title,
      description: aiVal.description,
      promptRefinement: aiVal.promptRefinement,
      visualPrompt: aiVal.visualPrompt,
      groundedAttributes: session.extractedAttributes, // Strictly ground in validated session attributes
      tokenAccounting: aiVal.tokenAccounting,
      actor,
    });

    if (conceptRes.isErr) {
      return err(conceptRes.error);
    }

    const concept = conceptRes.value;
    await this.conceptRepo.save(concept);

    return ok(concept);
  }

  async getConcept(
    conceptId: string,
    sessionId: string,
    tenantId: string
  ): Promise<Result<DesignConcept, DomainError>> {
    const concept = await this.conceptRepo.findById(
      createEntityId<DesignConceptId>(conceptId),
      createEntityId<TenantId>(tenantId)
    );

    if (!concept || concept.sessionId !== sessionId) {
      return err(new DesignConceptNotFoundError(conceptId));
    }

    return ok(concept);
  }

  async listConceptsBySession(
    sessionId: string,
    tenantId: string
  ): Promise<Result<DesignConcept[], DomainError>> {
    const concepts = await this.conceptRepo.listBySession(
      createEntityId<DesignSessionId>(sessionId),
      createEntityId<TenantId>(tenantId)
    );
    return ok(concepts);
  }

  async updateStatus(
    cmd: UpdateConceptStatusCommand
  ): Promise<Result<DesignConcept, DomainError>> {
    const tenantId = createEntityId<TenantId>(cmd.tenantId);
    const concept = await this.conceptRepo.findById(
      createEntityId<DesignConceptId>(cmd.conceptId),
      tenantId
    );

    if (!concept || concept.sessionId !== cmd.sessionId) {
      return err(new DesignConceptNotFoundError(cmd.conceptId));
    }

    const actor = cmd.actorId
      ? ActorReference.user(cmd.actorId).unwrapOr(ActorReference.system())
      : ActorReference.system();

    if (cmd.action === 'APPROVE') {
      const appRes = concept.approve(actor);
      if (appRes.isErr) return err(appRes.error);
    } else {
      const rejRes = concept.reject(actor);
      if (rejRes.isErr) return err(rejRes.error);
    }

    await this.conceptRepo.save(concept);
    return ok(concept);
  }
}
