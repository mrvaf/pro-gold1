import {
  type OrderRepositoryPort,
  type CartRepositoryPort,
  type StockReservationRepositoryPort,
  Order,
  Cart,
  CartItem,
  OrderLine,
  StockReservation,
  Money,
  createEntityId,
  type OrderId,
  type CartId,
  type StockReservationId,
  type TenantId,
  type UserId,
  CartNotFoundError,
  OrderNotFoundError,
  InsufficientInventoryError,
  StockReservationExpiredError,
  PaymentVerificationFailedError,
} from '@v-gold/core';

export interface AddToCartDto {
  tenantId: string;
  userId?: string;
  productId: string;
  variantId: string;
  sku: string;
  title: string;
  quantity: number;
  unitPrice: string;
  currency: 'USD' | 'EUR' | 'IRR' | 'TOMAN';
}

export interface CheckoutDto {
  tenantId: string;
  userId: string;
  idempotencyKey?: string;
}

export interface ProcessPaymentDto {
  orderId: string;
  tenantId: string;
  provider: 'MOCK_GATEWAY' | 'ZARINPAL' | 'STRIPE';
  paymentReferenceToken: string;
}

export class CommerceService {
  constructor(
    private readonly orderRepo: OrderRepositoryPort,
    private readonly cartRepo: CartRepositoryPort,
    private readonly stockReservationRepo: StockReservationRepositoryPort
  ) {}

  async getOrCreateCart(tenantId: string, userId?: string, currency: 'USD' | 'EUR' | 'IRR' | 'TOMAN' = 'USD'): Promise<Cart> {
    const tId = createEntityId<TenantId>(tenantId);
    const uId = userId ? createEntityId<UserId>(userId) : undefined;

    if (uId) {
      const existing = await this.cartRepo.findByUser(uId, tId);
      if (existing) return existing;
    }

    const cartId = createEntityId<CartId>(`cart_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    const newCart = Cart.create(cartId, tId, currency, uId);
    await this.cartRepo.save(newCart);
    return newCart;
  }

  async addItemToCart(dto: AddToCartDto): Promise<Cart> {
    const cart = await this.getOrCreateCart(dto.tenantId, dto.userId, dto.currency);
    const unitPrice = Money.create(dto.unitPrice, dto.currency).unwrap();

    const item = new CartItem({
      productId: dto.productId,
      variantId: dto.variantId,
      sku: dto.sku,
      title: dto.title,
      quantity: dto.quantity,
      unitPrice,
    });

    cart.addItem(item);
    await this.cartRepo.save(cart);
    return cart;
  }

  async checkoutCart(dto: CheckoutDto): Promise<Order> {
    const tId = createEntityId<TenantId>(dto.tenantId);
    const uId = createEntityId<UserId>(dto.userId);

    // 1. Idempotency Check
    if (dto.idempotencyKey) {
      const existingOrder = await this.orderRepo.findByIdempotencyKey(dto.idempotencyKey, tId);
      if (existingOrder) {
        return existingOrder;
      }
    }

    // 2. Fetch User Cart
    const cart = await this.cartRepo.findByUser(uId, tId);
    if (!cart || cart.items.length === 0) {
      throw new CartNotFoundError(cart?.id ?? 'user-cart');
    }

    const orderId = createEntityId<OrderId>(`ord_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);

    // 3. Reserve Stock Atomically
    for (const item of cart.items) {
      const reservationId = createEntityId<StockReservationId>(`res_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
      const reservation = StockReservation.create(
        reservationId,
        tId,
        item.sku,
        item.quantity,
        15, // 15 mins TTL
        orderId
      );
      await this.stockReservationRepo.save(reservation);
    }

    // 4. Transform Cart Items to Authoritative Order Lines
    const orderLines: OrderLine[] = cart.items.map(
      (item, index) =>
        new OrderLine({
          orderLineId: `line_${index + 1}`,
          productId: item.productId,
          variantId: item.variantId,
          sku: item.sku,
          title: item.title,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.lineTotal,
        })
    );

    const order = Order.create(orderId, {
      tenantId: tId,
      userId: uId,
      lines: orderLines,
      currency: cart.currency,
      idempotencyKey: dto.idempotencyKey,
    });

    await this.orderRepo.save(order);

    // Clear cart upon successful order placement
    cart.clear();
    await this.cartRepo.save(cart);

    return order;
  }

  async processPayment(dto: ProcessPaymentDto): Promise<Order> {
    const tId = createEntityId<TenantId>(dto.tenantId);
    const oId = createEntityId<OrderId>(dto.orderId);

    const order = await this.orderRepo.findById(oId, tId);
    if (!order) {
      throw new OrderNotFoundError(dto.orderId);
    }

    if (!dto.paymentReferenceToken || dto.paymentReferenceToken.startsWith('FAIL_')) {
      throw new PaymentVerificationFailedError('Declined by payment gateway');
    }

    // Commit stock reservations
    await this.stockReservationRepo.commitByOrder(order.id, tId);

    // Transition Order to PAID
    const payResult = order.markAsPaid({
      provider: dto.provider,
      transactionId: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      paidAmount: order.totalAmount,
      paidAt: new Date(),
    });

    if (payResult.isErr) {
      throw payResult.error;
    }

    await this.orderRepo.save(order);
    return order;
  }

  async getOrderById(orderId: string, tenantId: string): Promise<Order> {
    const order = await this.orderRepo.findById(
      createEntityId<OrderId>(orderId),
      createEntityId<TenantId>(tenantId)
    );
    if (!order) {
      throw new OrderNotFoundError(orderId);
    }
    return order;
  }

  async listUserOrders(userId: string, tenantId: string): Promise<Order[]> {
    return this.orderRepo.listByUser(
      createEntityId<UserId>(userId),
      createEntityId<TenantId>(tenantId)
    );
  }
}
