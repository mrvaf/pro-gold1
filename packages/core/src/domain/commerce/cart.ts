import { type EntityId } from '../../common/id.js';
import { type TenantId } from '../tenant/tenant.js';
import { type UserId } from '../iam/user.js';
import { Money } from '../finance/money.js';
import { CartItem } from './cart-item.js';

export type CartId = EntityId<'Cart'>;

export interface CartProps {
  tenantId: TenantId;
  userId?: UserId | undefined;
  currency: 'USD' | 'EUR' | 'IRR' | 'TOMAN';
  items: CartItem[];
  createdAt: Date;
  updatedAt: Date;
}

export class Cart {
  private readonly _id: CartId;
  private _props: CartProps;

  constructor(id: CartId, props: CartProps) {
    this._id = id;
    this._props = props;
  }

  static create(
    id: CartId,
    tenantId: TenantId,
    currency: 'USD' | 'EUR' | 'IRR' | 'TOMAN' = 'USD',
    userId?: UserId
  ): Cart {
    const now = new Date();
    return new Cart(id, {
      tenantId,
      userId,
      currency,
      items: [],
      createdAt: now,
      updatedAt: now,
    });
  }

  get id(): CartId {
    return this._id;
  }

  get tenantId(): TenantId {
    return this._props.tenantId;
  }

  get userId(): UserId | undefined {
    return this._props.userId;
  }

  get currency(): 'USD' | 'EUR' | 'IRR' | 'TOMAN' {
    return this._props.currency;
  }

  get items(): readonly CartItem[] {
    return this._props.items;
  }

  get total(): Money {
    let sum = this._props.items.reduce(
      (acc, item) => acc.plus(item.lineTotal.amount),
      this._props.items[0]?.unitPrice.amount.times(0) ?? Money.create('0.00', this._props.currency).unwrap().amount
    );
    return Money.create(sum.toString(), this._props.currency).unwrap();
  }

  addItem(item: CartItem): void {
    const existingIndex = this._props.items.findIndex(
      (i) => i.productId === item.productId && i.variantId === item.variantId
    );

    if (existingIndex >= 0) {
      const existing = this._props.items[existingIndex]!;
      this._props.items[existingIndex] = new CartItem({
        ...existing.props,
        quantity: existing.quantity + item.quantity,
      });
    } else {
      this._props.items.push(item);
    }
    this._props.updatedAt = new Date();
  }

  removeItem(variantId: string): void {
    this._props.items = this._props.items.filter((i) => i.variantId !== variantId);
    this._props.updatedAt = new Date();
  }

  clear(): void {
    this._props.items = [];
    this._props.updatedAt = new Date();
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      userId: this.userId,
      currency: this.currency,
      items: this._props.items.map((i) => i.toJSON()),
      total: {
        amount: this.total.amount.toString(),
        currency: this.total.currency,
      },
      createdAt: this._props.createdAt.toISOString(),
      updatedAt: this._props.updatedAt.toISOString(),
    };
  }
}
