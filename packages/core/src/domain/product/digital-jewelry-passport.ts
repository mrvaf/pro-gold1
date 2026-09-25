import { Entity } from '../../common/entity.js';
import { Result, ok, err } from '../../common/result.js';
import { createEntityId, type EntityId } from '../../common/id.js';
import { StyleDna } from './style-dna.js';

export type DigitalJewelryPassportId = EntityId<'DigitalJewelryPassport'>;

export interface ProvenanceEvent {
  eventId: string;
  eventType: 'ORIGIN_MANUFACTURE' | 'HALLMARK_CERTIFIED' | 'OWNERSHIP_TRANSFERRED' | 'REPAIR_SERVICED';
  actorId: string;
  timestamp: Date;
  details: Record<string, unknown>;
  signatureDigest?: string;
}

export interface JewelryPassportProps {
  tenantId: string;
  productId: string;
  serialNumber: string;
  digitalCertificateNumber: string;
  styleDna: StyleDna;
  provenanceHistory: readonly ProvenanceEvent[];
  createdAt: Date;
}

export class DigitalJewelryPassport extends Entity<DigitalJewelryPassportId> {
  private readonly _props: JewelryPassportProps;

  private constructor(id: DigitalJewelryPassportId, props: JewelryPassportProps) {
    super(id);
    this._props = props;
  }

  static create(rawId: string, props: JewelryPassportProps): Result<DigitalJewelryPassport, string> {
    if (!rawId || rawId.trim().length === 0) {
      return err('Passport ID cannot be empty');
    }
    if (!props.tenantId || props.tenantId.trim().length === 0) {
      return err('Tenant ID cannot be empty');
    }
    if (!props.productId || props.productId.trim().length === 0) {
      return err('Product ID cannot be empty');
    }
    if (!props.serialNumber || props.serialNumber.trim().length === 0) {
      return err('Serial number cannot be empty');
    }
    if (!props.digitalCertificateNumber || props.digitalCertificateNumber.trim().length === 0) {
      return err('Digital certificate number cannot be empty');
    }

    const id = createEntityId<DigitalJewelryPassportId>(rawId.trim());

    return ok(
      new DigitalJewelryPassport(id, {
        ...props,
        provenanceHistory: Object.freeze([...(props.provenanceHistory || [])]),
      })
    );
  }

  get tenantId(): string {
    return this._props.tenantId;
  }

  get productId(): string {
    return this._props.productId;
  }

  get serialNumber(): string {
    return this._props.serialNumber;
  }

  get digitalCertificateNumber(): string {
    return this._props.digitalCertificateNumber;
  }

  get styleDna(): StyleDna {
    return this._props.styleDna;
  }

  get provenanceHistory(): readonly ProvenanceEvent[] {
    return this._props.provenanceHistory;
  }

  get createdAt(): Date {
    return this._props.createdAt;
  }

  appendProvenanceEvent(event: ProvenanceEvent): Result<DigitalJewelryPassport, string> {
    if (!event.eventId) return err('Event ID is required');
    if (!event.eventType) return err('Event type is required');

    const updatedEvents = [...this._props.provenanceHistory, event];
    return ok(
      new DigitalJewelryPassport(this.id, {
        ...this._props,
        provenanceHistory: Object.freeze(updatedEvents),
      })
    );
  }
}
