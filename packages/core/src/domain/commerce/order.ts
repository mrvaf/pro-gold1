import { Result, ok, err } from '../../common/result.js';
import { type EntityId } from '../../common/id.js';
import { type TenantId } from '../tenant/tenant.js';
import { type UserId } from '../iam/user.js';
import { Money } from '../finance/money.js';
import { OrderLine } from './order-line.js';
import { InvalidOrderStateTransitionError } from './commerce-errors.js';

export type OrderId = EntityId<'Order'>;

export const ORDER_STATUSES = [
  'PENDING_PAYMENT',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface PaymentDetails {
  provider: 'MOCK_GATEWAY' | 'ZARINPAL' | 'STRIPE';
  transactionId: string;
  paidAmount: Money;
  paidAt: Date;
}

export interface OrderProps {
  tenantId: TenantId;
  userId: UserId;
  status: OrderStatus;
  lines: OrderLine[];
  currency: 'USD' | 'EUR' | 'IRR' | 'TOMAN';
  subtotal: Money;
  taxAmount: Money;
  totalAmount: Money;
  idempotencyKey?: string | undefined;
  paymentDetails?: PaymentDetails | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrderInput {
  tenantId: TenantId;
  userId: UserId;
  lines: OrderLine[];
  currency: 'USD' | 'EUR' | 'IRR' | 'TOMAN';
  taxAmount?: Money | undefined;
  idempotencyKey?: string | undefined;
}

export class Order {
  private readonly _id: OrderId;
  private _props: OrderProps;

  constructor(id: OrderId, props: OrderProps) {
    this._id = id;
    this._props = props;
  }

  static create(id: OrderId, input: CreateOrderInput): Order {
    const zero = Money.create('0.00', input.currency).unwrap();
    const subtotalDec = input.lines.reduce(
      (sum, l) => sum.plus(l.subtotal.amount),
      zero.amount
    );
    const subtotal = Money.create(subtotalDec.toString(), input.currency).unwrap();
    const taxAmount = input.taxAmount ?? zero;
    const totalAmount = Money.create(
      subtotal.amount.plus(taxAmount.amount).toString(),
      input.currency
    ).unwrap();

    const now = new Date();
    return new Order(id, {
      tenantId: input.tenantId,
      userId: input.userId,
      status: 'PENDING_PAYMENT',
      lines: input.lines,
      currency: input.currency,
      subtotal,
      taxAmount,
      totalAmount,
      idempotencyKey: input.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    });
  }

  get id(): OrderId {
    return this._id;
  }

  get tenantId(): TenantId {
    return this._props.tenantId;
  }

  get userId(): UserId {
    return this._props.userId;
  }

  get status(): OrderStatus {
    return this._props.status;
  }

  get lines(): readonly OrderLine[] {
    return this._props.lines;
  }

  get currency(): 'USD' | 'EUR' | 'IRR' | 'TOMAN' {
    return this._props.currency;
  }

  get subtotal(): Money {
    return this._props.subtotal;
  }

  get taxAmount(): Money {
    return this._props.taxAmount;
  }

  get totalAmount(): Money {
    return this._props.totalAmount;
  }

  get idempotencyKey(): string | undefined {
    return this._props.idempotencyKey;
  }

  get paymentDetails(): PaymentDetails | undefined {
    return this._props.paymentDetails;
  }

  get createdAt(): Date {
    return this._props.createdAt;
  }

  get updatedAt(): Date {
    return this._props.updatedAt;
  }

  markAsPaid(payment: PaymentDetails): Result<void, InvalidOrderStateTransitionError> {
    if (this._props.status !== 'PENDING_PAYMENT') {
      return err(new InvalidOrderStateTransitionError(this._props.status, 'PAID'));
    }
    this._props.status = 'PAID';
    this._props.paymentDetails = payment;
    this._props.updatedAt = new Date();
    return ok(undefined);
  }

  markAsProcessing(): Result<void, InvalidOrderStateTransitionError> {
    if (this._props.status !== 'PAID') {
      return err(new InvalidOrderStateTransitionError(this._props.status, 'PROCESSING'));
    }
    this._props.status = 'PROCESSING';
    this._props.updatedAt = new Date();
    return ok(undefined);
  }

  markAsShipped(): Result<void, InvalidOrderStateTransitionError> {
    if (this._props.status !== 'PROCESSING') {
      return err(new InvalidOrderStateTransitionError(this._props.status, 'SHIPPED'));
    }
    this._props.status = 'SHIPPED';
    this._props.updatedAt = new Date();
    return ok(undefined);
  }

  markAsDelivered(): Result<void, InvalidOrderStateTransitionError> {
    if (this._props.status !== 'SHIPPED') {
      return err(new InvalidOrderStateTransitionError(this._props.status, 'DELIVERED'));
    }
    this._props.status = 'DELIVERED';
    this._props.updatedAt = new Date();
    return ok(undefined);
  }

  cancel(): Result<void, InvalidOrderStateTransitionError> {
    if (this._props.status === 'DELIVERED' || this._props.status === 'REFUNDED') {
      return err(new InvalidOrderStateTransitionError(this._props.status, 'CANCELLED'));
    }
    this._props.status = 'CANCELLED';
    this._props.updatedAt = new Date();
    return ok(undefined);
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      userId: this.userId,
      status: this.status,
      lines: this.lines.map((l) => l.toJSON()),
      currency: this.currency,
      subtotal: {
        amount: this.subtotal.amount.toString(),
        currency: this.subtotal.currency,
      },
      taxAmount: {
        amount: this.taxAmount.amount.toString(),
        currency: this.taxAmount.currency,
      },
      totalAmount: {
        amount: this.totalAmount.amount.toString(),
        currency: this.totalAmount.currency,
      },
      idempotencyKey: this.idempotencyKey,
      paymentDetails: this.paymentDetails
        ? {
            provider: this.paymentDetails.provider,
            transactionId: this.paymentDetails.transactionId,
            paidAmount: {
              amount: this.paymentDetails.paidAmount.amount.toString(),
              currency: this.paymentDetails.paidAmount.currency,
            },
            paidAt: this.paymentDetails.paidAt.toISOString(),
          }
        : undefined,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
