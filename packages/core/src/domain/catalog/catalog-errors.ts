import { DomainError } from '../../common/errors.js';

export class CatalogError extends DomainError {
  readonly code: string = 'CATALOG_ERROR';
  readonly httpStatus: number = 400;
}

export class DuplicateSkuError extends DomainError {
  readonly code: string = 'DUPLICATE_SKU';
  readonly httpStatus: number = 409;

  constructor(sku: string, tenantId: string) {
    super(`SKU "${sku}" already exists in tenant "${tenantId}".`);
  }
}

export class ProductNotFoundError extends DomainError {
  readonly code: string = 'PRODUCT_NOT_FOUND';
  readonly httpStatus: number = 404;

  constructor(productId: string) {
    super(`Product with ID "${productId}" not found.`);
  }
}

export class ProductVariantNotFoundError extends DomainError {
  readonly code: string = 'PRODUCT_VARIANT_NOT_FOUND';
  readonly httpStatus: number = 404;

  constructor(variantId: string) {
    super(`Product variant with ID "${variantId}" not found.`);
  }
}
