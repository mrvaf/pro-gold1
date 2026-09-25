import { type EntityId } from '../../common/id.js';
import { type TenantId } from '../tenant/tenant.js';

export type StockReservationId = EntityId<'StockReservation'>;

export interface StockReservationProps {
  tenantId: TenantId;
  orderId?: string | undefined;
  sku: string;
  quantity: number;
  expiresAt: Date;
  isCommitted: boolean;
  createdAt: Date;
}

export class StockReservation {
  private readonly _id: StockReservationId;
  private _props: StockReservationProps;

  constructor(id: StockReservationId, props: StockReservationProps) {
    this._id = id;
    this._props = props;
  }

  static create(
    id: StockReservationId,
    tenantId: TenantId,
    sku: string,
    quantity: number,
    ttlMinutes: number = 15,
    orderId?: string
  ): StockReservation {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

    return new StockReservation(id, {
      tenantId,
      orderId,
      sku,
      quantity,
      expiresAt,
      isCommitted: false,
      createdAt: now,
    });
  }

  get id(): StockReservationId {
    return this._id;
  }

  get tenantId(): TenantId {
    return this._props.tenantId;
  }

  get orderId(): string | undefined {
    return this._props.orderId;
  }

  get sku(): string {
    return this._props.sku;
  }

  get quantity(): number {
    return this._props.quantity;
  }

  get expiresAt(): Date {
    return this._props.expiresAt;
  }

  get isCommitted(): boolean {
    return this._props.isCommitted;
  }

  isExpired(): boolean {
    return !this._props.isCommitted && new Date().getTime() > this._props.expiresAt.getTime();
  }

  commit(): void {
    this._props.isCommitted = true;
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      orderId: this.orderId,
      sku: this.sku,
      quantity: this.quantity,
      expiresAt: this.expiresAt.toISOString(),
      isCommitted: this.isCommitted,
      isExpired: this.isExpired(),
      createdAt: this._props.createdAt.toISOString(),
    };
  }
}
