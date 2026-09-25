import type { TenantId } from '../tenant/tenant.js';
import {
  InvalidGuildLicenseError,
  InvalidHallmarkAuditError,
} from './trust-safety-errors.js';

export const LICENSE_STATUSES = ['PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED'] as const;
export type LicenseStatus = (typeof LICENSE_STATUSES)[number];

export interface GuildLicenseProps {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly sellerProfileId: string;
  readonly guildRegistrationNumber: string;
  readonly guildName: string;
  readonly issuanceDate: Date;
  readonly expiryDate: Date;
  readonly status: LicenseStatus;
  readonly verifiedAt?: Date | undefined;
  readonly rejectedReason?: string | undefined;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class GuildLicense {
  private constructor(private props: GuildLicenseProps) {}

  public static create(params: {
    id: string;
    tenantId: TenantId;
    sellerProfileId: string;
    guildRegistrationNumber: string;
    guildName: string;
    issuanceDate: Date;
    expiryDate: Date;
    status?: LicenseStatus | undefined;
    verifiedAt?: Date | undefined;
    rejectedReason?: string | undefined;
    createdAt?: Date | undefined;
    updatedAt?: Date | undefined;
  }): GuildLicense {
    if (!params.id || params.id.trim().length === 0) {
      throw new InvalidGuildLicenseError('License ID cannot be empty');
    }
    if (!params.tenantId || params.tenantId.trim().length === 0) {
      throw new InvalidGuildLicenseError('Tenant ID cannot be empty');
    }
    if (!params.sellerProfileId || params.sellerProfileId.trim().length === 0) {
      throw new InvalidGuildLicenseError('Seller profile ID cannot be empty');
    }
    if (!params.guildRegistrationNumber || params.guildRegistrationNumber.trim().length === 0) {
      throw new InvalidGuildLicenseError('Guild registration number cannot be empty');
    }
    if (!params.guildName || params.guildName.trim().length === 0) {
      throw new InvalidGuildLicenseError('Guild name cannot be empty');
    }
    if (params.expiryDate.getTime() <= params.issuanceDate.getTime()) {
      throw new InvalidGuildLicenseError('License expiry date must be strictly after issuance date');
    }

    const now = new Date();
    return new GuildLicense({
      id: params.id,
      tenantId: params.tenantId,
      sellerProfileId: params.sellerProfileId,
      guildRegistrationNumber: params.guildRegistrationNumber.trim(),
      guildName: params.guildName.trim(),
      issuanceDate: params.issuanceDate,
      expiryDate: params.expiryDate,
      status: params.status ?? 'PENDING',
      verifiedAt: params.verifiedAt,
      rejectedReason: params.rejectedReason,
      createdAt: params.createdAt ?? now,
      updatedAt: params.updatedAt ?? now,
    });
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): TenantId {
    return this.props.tenantId;
  }
  get sellerProfileId(): string {
    return this.props.sellerProfileId;
  }
  get guildRegistrationNumber(): string {
    return this.props.guildRegistrationNumber;
  }
  get guildName(): string {
    return this.props.guildName;
  }
  get issuanceDate(): Date {
    return this.props.issuanceDate;
  }
  get expiryDate(): Date {
    return this.props.expiryDate;
  }
  get status(): LicenseStatus {
    return this.props.status;
  }
  get verifiedAt(): Date | undefined {
    return this.props.verifiedAt;
  }
  get rejectedReason(): string | undefined {
    return this.props.rejectedReason;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  verify(): void {
    const now = new Date();
    if (this.props.expiryDate.getTime() < now.getTime()) {
      this.props = {
        ...this.props,
        status: 'EXPIRED',
        updatedAt: now,
      };
      throw new InvalidGuildLicenseError('Cannot verify an expired guild license');
    }
    this.props = {
      ...this.props,
      status: 'VERIFIED',
      verifiedAt: now,
      rejectedReason: undefined,
      updatedAt: now,
    };
  }

  reject(reason: string): void {
    if (!reason || reason.trim().length === 0) {
      throw new InvalidGuildLicenseError('Rejection reason must be provided');
    }
    const now = new Date();
    this.props = {
      ...this.props,
      status: 'REJECTED',
      rejectedReason: reason.trim(),
      updatedAt: now,
    };
  }

  toJSON(): GuildLicenseProps {
    return { ...this.props };
  }
}

export interface HallmarkAuditRecordProps {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly inventoryItemId?: string | undefined;
  readonly productVariantId?: string | undefined;
  readonly hallmarkCode: string; // e.g. T750 (Tehran 18K), E750 (Isfahan 18K)
  readonly labAuthority: string;
  readonly verifiedFineness: number; // e.g. 750
  readonly auditNotes?: string | undefined;
  readonly auditedAt: Date;
}

export class HallmarkAuditRecord {
  private constructor(private readonly props: HallmarkAuditRecordProps) {}

  public static create(params: {
    id: string;
    tenantId: TenantId;
    inventoryItemId?: string | undefined;
    productVariantId?: string | undefined;
    hallmarkCode: string;
    labAuthority: string;
    verifiedFineness: number;
    auditNotes?: string | undefined;
    auditedAt?: Date | undefined;
  }): HallmarkAuditRecord {
    if (!params.id || params.id.trim().length === 0) {
      throw new InvalidHallmarkAuditError('Hallmark audit ID cannot be empty');
    }
    if (!params.tenantId || params.tenantId.trim().length === 0) {
      throw new InvalidHallmarkAuditError('Tenant ID cannot be empty');
    }
    if (!params.hallmarkCode || params.hallmarkCode.trim().length === 0) {
      throw new InvalidHallmarkAuditError('Hallmark code cannot be empty');
    }
    if (!params.labAuthority || params.labAuthority.trim().length === 0) {
      throw new InvalidHallmarkAuditError('Assay lab authority cannot be empty');
    }
    if (params.verifiedFineness < 375 || params.verifiedFineness > 999.9) {
      throw new InvalidHallmarkAuditError('Verified fineness must be between 375 and 999.9');
    }

    return new HallmarkAuditRecord({
      id: params.id,
      tenantId: params.tenantId,
      inventoryItemId: params.inventoryItemId,
      productVariantId: params.productVariantId,
      hallmarkCode: params.hallmarkCode.trim().toUpperCase(),
      labAuthority: params.labAuthority.trim(),
      verifiedFineness: params.verifiedFineness,
      auditNotes: params.auditNotes,
      auditedAt: params.auditedAt ?? new Date(),
    });
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): TenantId {
    return this.props.tenantId;
  }
  get inventoryItemId(): string | undefined {
    return this.props.inventoryItemId;
  }
  get productVariantId(): string | undefined {
    return this.props.productVariantId;
  }
  get hallmarkCode(): string {
    return this.props.hallmarkCode;
  }
  get labAuthority(): string {
    return this.props.labAuthority;
  }
  get verifiedFineness(): number {
    return this.props.verifiedFineness;
  }
  get auditNotes(): string | undefined {
    return this.props.auditNotes;
  }
  get auditedAt(): Date {
    return this.props.auditedAt;
  }

  toJSON(): HallmarkAuditRecordProps {
    return { ...this.props };
  }
}
