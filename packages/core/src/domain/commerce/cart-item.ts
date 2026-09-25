import { Money } from '../finance/money.js';

export interface CartItemProps {
  productId: string;
  variantId: string;
  sku: string;
  title: string;
  quantity: number;
  unitPrice: Money;
}

export class CartItem {
  constructor(readonly props: CartItemProps) {}

  get productId(): string {
    return this.props.productId;
  }

  get variantId(): string {
    return this.props.variantId;
  }

  get sku(): string {
    return this.props.sku;
  }

  get title(): string {
    return this.props.title;
  }

  get quantity(): number {
    return this.props.quantity;
  }

  get unitPrice(): Money {
    return this.props.unitPrice;
  }

  get lineTotal(): Money {
    const totalAmount = this.props.unitPrice.amount.times(this.props.quantity);
    return Money.create(totalAmount.toString(), this.props.unitPrice.currency).unwrap();
  }

  toJSON() {
    return {
      productId: this.props.productId,
      variantId: this.props.variantId,
      sku: this.props.sku,
      title: this.props.title,
      quantity: this.props.quantity,
      unitPrice: {
        amount: this.props.unitPrice.amount.toString(),
        currency: this.props.unitPrice.currency,
      },
      lineTotal: {
        amount: this.lineTotal.amount.toString(),
        currency: this.lineTotal.currency,
      },
    };
  }
}
