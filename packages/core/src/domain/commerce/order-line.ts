import { Money } from '../finance/money.js';

export interface OrderLineProps {
  orderLineId: string;
  productId: string;
  variantId: string;
  sku: string;
  title: string;
  quantity: number;
  unitPrice: Money;
  subtotal: Money;
}

export class OrderLine {
  constructor(readonly props: OrderLineProps) {}

  get orderLineId(): string {
    return this.props.orderLineId;
  }

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

  get subtotal(): Money {
    return this.props.subtotal;
  }

  toJSON() {
    return {
      orderLineId: this.props.orderLineId,
      productId: this.props.productId,
      variantId: this.props.variantId,
      sku: this.props.sku,
      title: this.props.title,
      quantity: this.props.quantity,
      unitPrice: {
        amount: this.props.unitPrice.amount.toString(),
        currency: this.props.unitPrice.currency,
      },
      subtotal: {
        amount: this.props.subtotal.amount.toString(),
        currency: this.props.subtotal.currency,
      },
    };
  }
}
