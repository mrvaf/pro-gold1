import {
  type DesignSessionRepositoryPort,
  type AiGatewayPort,
  DesignSession,
  DesignSessionNotFoundError,
  ExtractedDesignAttributes,
  type ExtractedDesignAttributesProps,
  type DesignSessionId,
  type TenantId,
  type UserId,
  createEntityId,
  ActorReference,
  ValidationError,
  ok,
  err,
  type Result,
  type DomainError,
} from '@v-gold/core';

export interface CreateDesignSessionCommand {
  tenantId: string;
  userId?: string;
  title?: string;
  initialMessage?: string;
  actorId?: string;
}

export interface AddMessageCommand {
  sessionId: string;
  tenantId: string;
  content: string;
  actorId?: string;
}

export interface CompleteDesignSessionCommand {
  sessionId: string;
  tenantId: string;
  actorId?: string;
}

export class DesignSessionService {
  constructor(
    private readonly sessionRepo: DesignSessionRepositoryPort,
    private readonly aiGateway: AiGatewayPort
  ) {}

  async createSession(
    cmd: CreateDesignSessionCommand
  ): Promise<Result<DesignSession, DomainError>> {
    const actor = cmd.actorId
      ? ActorReference.user(cmd.actorId).unwrapOr(ActorReference.system())
      : ActorReference.system();

    const sessionRes = DesignSession.create({
      tenantId: createEntityId<TenantId>(cmd.tenantId),
      userId: cmd.userId ? createEntityId<UserId>(cmd.userId) : undefined,
      title: cmd.title,
      initialMessage: cmd.initialMessage,
      actor,
    });

    if (sessionRes.isErr) return err(sessionRes.error);
    const session = sessionRes.value;

    // If an initial message is provided, trigger attribute extraction immediately
    if (cmd.initialMessage && cmd.initialMessage.trim().length > 0 && this.aiGateway.extractDesignAttributes) {
      const extractionRes = await this.aiGateway.extractDesignAttributes({
        latestUserMessage: cmd.initialMessage,
        currentAttributes: session.extractedAttributes,
      });

      if (extractionRes.isOk) {
        session.updateExtractedAttributes(extractionRes.value.extractedAttributes);
        session.addMessage({
          role: 'ASSISTANT',
          content: extractionRes.value.assistantReply,
        });
      }
    }

    await this.sessionRepo.save(session);
    return ok(session);
  }

  async getSession(
    sessionId: string,
    tenantId: string
  ): Promise<Result<DesignSession, DomainError>> {
    const session = await this.sessionRepo.findById(
      createEntityId<DesignSessionId>(sessionId),
      createEntityId<TenantId>(tenantId)
    );

    if (!session) {
      return err(new DesignSessionNotFoundError(sessionId));
    }

    return ok(session);
  }

  async listSessions(
    tenantId: string,
    limit?: number
  ): Promise<Result<DesignSession[], DomainError>> {
    const sessions = await this.sessionRepo.listByTenant(
      createEntityId<TenantId>(tenantId),
      limit
    );
    return ok(sessions);
  }

  async addMessage(
    cmd: AddMessageCommand
  ): Promise<Result<DesignSession, DomainError>> {
    const session = await this.sessionRepo.findById(
      createEntityId<DesignSessionId>(cmd.sessionId),
      createEntityId<TenantId>(cmd.tenantId)
    );

    if (!session) {
      return err(new DesignSessionNotFoundError(cmd.sessionId));
    }

    const actor = cmd.actorId
      ? ActorReference.user(cmd.actorId).unwrapOr(ActorReference.system())
      : ActorReference.system();

    // 1. Add user message
    const msgRes = session.addMessage(
      {
        role: 'USER',
        content: cmd.content,
      },
      actor
    );

    if (msgRes.isErr) return err(msgRes.error);

    // 2. Run AI extraction if supported
    if (this.aiGateway.extractDesignAttributes) {
      const history = session.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const extractionRes = await this.aiGateway.extractDesignAttributes({
        conversationHistory: history,
        latestUserMessage: cmd.content,
        currentAttributes: session.extractedAttributes,
      });

      if (extractionRes.isOk) {
        session.updateExtractedAttributes(extractionRes.value.extractedAttributes, actor);
        session.addMessage(
          {
            role: 'ASSISTANT',
            content: extractionRes.value.assistantReply,
          },
          ActorReference.system()
        );
      }
    }

    await this.sessionRepo.save(session);
    return ok(session);
  }

  async completeSession(
    cmd: CompleteDesignSessionCommand
  ): Promise<Result<DesignSession, DomainError>> {
    const session = await this.sessionRepo.findById(
      createEntityId<DesignSessionId>(cmd.sessionId),
      createEntityId<TenantId>(cmd.tenantId)
    );

    if (!session) {
      return err(new DesignSessionNotFoundError(cmd.sessionId));
    }

    const actor = cmd.actorId
      ? ActorReference.user(cmd.actorId).unwrapOr(ActorReference.system())
      : ActorReference.system();
    const compRes = session.complete(actor);
    if (compRes.isErr) return err(compRes.error);

    await this.sessionRepo.save(session);
    return ok(session);
  }
}
