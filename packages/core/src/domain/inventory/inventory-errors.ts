import { DomainError } from '../../common/errors.js';

export class InventoryError extends DomainError {
  readonly code: string = 'INVENTORY_ERROR';
  readonly httpStatus: number = 400;
}

export class InventoryItemNotFoundError extends DomainError {
  readonly code: string = 'INVENTORY_ITEM_NOT_FOUND';
  readonly httpStatus: number = 404;

  constructor(itemId: string) {
    super(`Inventory item with ID "${itemId}" not found.`);
  }
}

export class InventoryLocationNotFoundError extends DomainError {
  readonly code: string = 'INVENTORY_LOCATION_NOT_FOUND';
  readonly httpStatus: number = 404;

  constructor(locationId: string) {
    super(`Inventory location with ID "${locationId}" not found.`);
  }
}

export class DuplicateLocationCodeError extends DomainError {
  readonly code: string = 'DUPLICATE_LOCATION_CODE';
  readonly httpStatus: number = 409;

  constructor(code: string, tenantId: string) {
    super(`Inventory location code "${code}" already exists for tenant "${tenantId}".`);
  }
}

export class DuplicateSerialNumberError extends DomainError {
  readonly code: string = 'DUPLICATE_SERIAL_NUMBER';
  readonly httpStatus: number = 409;

  constructor(serial: string, tenantId: string) {
    super(`Serial number "${serial}" already exists in tenant "${tenantId}".`);
  }
}
