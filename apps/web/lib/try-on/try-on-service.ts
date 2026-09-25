import {
  type TenantId,
  type ProductId,
  type ProductVariantId,
  createEntityId,
  type Result,
  ok,
  err,
  DomainError,
  TryOnSession,
  type TryOnSessionId,
  type TryOnSessionRepositoryPort,
  type Studio3DAssetId,
  type Studio3DAssetRepositoryPort,
  type Studio3DStoragePort,
  BodyPartAnchoring,
  type BodyPartAnchoringType,
  TryOnSessionNotFoundError,
  Studio3DAssetNotFoundError,
} from '@v-gold/core';

export interface CreateTryOnSessionCommand {
  tenantId: TenantId;
  productId: ProductId;
  variantId?: ProductVariantId | undefined;
  asset3dId: Studio3DAssetId;
  bodyPart: BodyPartAnchoringType;
  scaleFactor?: number | undefined;
  anchorOffset?: { x: number; y: number; z: number } | undefined;
  biometricFingerSizeMm?: number | undefined;
  wristCircumferenceMm?: number | undefined;
  durationSeconds?: number | undefined; // default 600 seconds
}

export class TryOnService {
  constructor(
    private readonly tryOnRepo: TryOnSessionRepositoryPort,
    private readonly assetRepo: Studio3DAssetRepositoryPort,
    private readonly storage: Studio3DStoragePort
  ) {}

  async createSession(
    cmd: CreateTryOnSessionCommand
  ): Promise<Result<TryOnSession, DomainError>> {
    // 1. Verify 3D asset exists and belongs to tenant
    const asset = await this.assetRepo.findById(cmd.asset3dId, cmd.tenantId);
    if (!asset) {
      return err(new Studio3DAssetNotFoundError(cmd.asset3dId));
    }

    // 2. Validate Anchoring Configuration
    const anchoringRes = BodyPartAnchoring.create({
      bodyPart: cmd.bodyPart,
      scaleFactor: cmd.scaleFactor ?? 1.0,
      anchorOffsetX: cmd.anchorOffset?.x ?? 0.0,
      anchorOffsetY: cmd.anchorOffset?.y ?? 0.0,
      anchorOffsetZ: cmd.anchorOffset?.z ?? 0.0,
      biometricFingerSizeMm: cmd.biometricFingerSizeMm,
      wristCircumferenceMm: cmd.wristCircumferenceMm,
    });

    if (anchoringRes.isErr) {
      return err(anchoringRes.error);
    }

    // 3. Generate Temporary Signed URL matching the privacy lifecycle
    const duration = cmd.durationSeconds ?? 600;
    const signedAssetUrl = await this.storage.generateSignedDownloadUrl(asset.storageKey, {
      expiresInSeconds: duration,
    });

    // 4. Create and persist try-on session
    const sessionId = createEntityId<TryOnSessionId>(`tryon_${Date.now()}`);
    const session = TryOnSession.create(sessionId, {
      tenantId: cmd.tenantId,
      productId: cmd.productId,
      variantId: cmd.variantId,
      asset3dId: cmd.asset3dId,
      anchoring: anchoringRes.value,
      signedAssetUrl,
      durationSeconds: duration,
    });

    await this.tryOnRepo.save(session);
    return ok(session);
  }

  async getActiveSession(
    sessionId: TryOnSessionId,
    tenantId: TenantId
  ): Promise<Result<TryOnSession, DomainError>> {
    const session = await this.tryOnRepo.findById(sessionId, tenantId);
    if (!session) {
      return err(new TryOnSessionNotFoundError(sessionId));
    }

    const activeRes = session.verifyActive();
    if (activeRes.isErr) {
      await this.tryOnRepo.save(session);
      return err(activeRes.error);
    }

    return ok(session);
  }

  async completeSession(
    sessionId: TryOnSessionId,
    tenantId: TenantId
  ): Promise<Result<TryOnSession, DomainError>> {
    const session = await this.tryOnRepo.findById(sessionId, tenantId);
    if (!session) {
      return err(new TryOnSessionNotFoundError(sessionId));
    }

    session.complete();
    await this.tryOnRepo.save(session);
    return ok(session);
  }
}
