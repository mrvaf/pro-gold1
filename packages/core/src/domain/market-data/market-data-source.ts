import { Entity } from '../../common/entity.js';
import { createEntityId, type EntityId } from '../../common/id.js';
import { ValidationError } from '../../common/errors.js';
import { err, ok, type Result } from '../../common/result.js';

export type MarketDataSourceId = EntityId<'MarketDataSource'>;

export function createMarketDataSourceId(raw: string): Result<MarketDataSourceId, ValidationError> {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length < 2 || trimmed.length > 64) {
    return err(new ValidationError(`MarketDataSourceId must be between 2 and 64 characters: "${raw}"`));
  }
  return ok(createEntityId<MarketDataSourceId>(trimmed));
}

export interface MarketDataSourceDto {
  id: string;
  name: string;
  code: string;
  description?: string | undefined;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * MarketDataSource Entity.
 * Represents an authoritative external market data provider or exchange.
 */
export class MarketDataSource extends Entity<MarketDataSourceId> {
  private _name: string;
  private _code: string;
  private _description?: string | undefined;
  private _isActive: boolean;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(
    id: MarketDataSourceId,
    name: string,
    code: string,
    description: string | undefined,
    isActive: boolean,
    createdAt: Date,
    updatedAt: Date
  ) {
    super(id);
    this._name = name;
    this._code = code;
    this._description = description;
    this._isActive = isActive;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
  }

  get name(): string {
    return this._name;
  }

  get code(): string {
    return this._code;
  }

  get description(): string | undefined {
    return this._description;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  static create(params: {
    id: string;
    name: string;
    code: string;
    description?: string | undefined;
    isActive?: boolean | undefined;
    createdAt?: Date | undefined;
    updatedAt?: Date | undefined;
  }): Result<MarketDataSource, ValidationError> {
    const idResult = createMarketDataSourceId(params.id);
    if (idResult.isErr) return err(idResult.error);

    const name = params.name.trim();
    if (!name || name.length > 128) {
      return err(new ValidationError('MarketDataSource name must be between 1 and 128 characters.'));
    }

    const code = params.code.trim().toUpperCase();
    if (!code || code.length > 64) {
      return err(new ValidationError('MarketDataSource code must be between 1 and 64 characters.'));
    }

    const now = new Date();
    return ok(
      new MarketDataSource(
        idResult.value,
        name,
        code,
        params.description?.trim(),
        params.isActive ?? true,
        params.createdAt ?? now,
        params.updatedAt ?? now
      )
    );
  }

  static reconstitute(
    id: MarketDataSourceId,
    name: string,
    code: string,
    description: string | undefined,
    isActive: boolean,
    createdAt: Date,
    updatedAt: Date
  ): MarketDataSource {
    return new MarketDataSource(id, name, code, description, isActive, createdAt, updatedAt);
  }

  deactivate(): void {
    this._isActive = false;
    this._updatedAt = new Date();
  }

  activate(): void {
    this._isActive = true;
    this._updatedAt = new Date();
  }

  toDto(): MarketDataSourceDto {
    return {
      id: this.id,
      name: this._name,
      code: this._code,
      description: this._description,
      isActive: this._isActive,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
