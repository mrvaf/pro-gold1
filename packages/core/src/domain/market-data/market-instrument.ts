import { Entity } from '../../common/entity.js';
import { createEntityId, type EntityId } from '../../common/id.js';
import { ValidationError } from '../../common/errors.js';
import { err, ok, type Result } from '../../common/result.js';
import { parseCurrencyCode, type CurrencyCode } from '../finance/currency.js';
import { parseMarketUnit, type MarketUnitCode } from './market-unit.js';
import type { MarketAssetType } from './market-data-types.js';

export type MarketInstrumentId = EntityId<'MarketInstrument'>;

export function createMarketInstrumentId(raw: string): Result<MarketInstrumentId, ValidationError> {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length < 2 || trimmed.length > 64) {
    return err(new ValidationError(`MarketInstrumentId must be between 2 and 64 characters: "${raw}"`));
  }
  return ok(createEntityId<MarketInstrumentId>(trimmed));
}

export interface MarketInstrumentDto {
  id: string;
  symbol: string;
  baseAsset: string;
  quoteCurrency: string;
  unit: string;
  displayName: string;
  assetType: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * MarketInstrument Entity.
 * Uniquely identifies a financial or commodity instrument quoted by market providers.
 * Distinguishes metal identity, quote currency, trading unit, and price basis.
 */
export class MarketInstrument extends Entity<MarketInstrumentId> {
  private _symbol: string;
  private _baseAsset: string;
  private _quoteCurrency: CurrencyCode;
  private _unit: MarketUnitCode;
  private _displayName: string;
  private _assetType: MarketAssetType;
  private _isActive: boolean;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(
    id: MarketInstrumentId,
    symbol: string,
    baseAsset: string,
    quoteCurrency: CurrencyCode,
    unit: MarketUnitCode,
    displayName: string,
    assetType: MarketAssetType,
    isActive: boolean,
    createdAt: Date,
    updatedAt: Date
  ) {
    super(id);
    this._symbol = symbol;
    this._baseAsset = baseAsset;
    this._quoteCurrency = quoteCurrency;
    this._unit = unit;
    this._displayName = displayName;
    this._assetType = assetType;
    this._isActive = isActive;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
  }

  get symbol(): string {
    return this._symbol;
  }

  get baseAsset(): string {
    return this._baseAsset;
  }

  get quoteCurrency(): CurrencyCode {
    return this._quoteCurrency;
  }

  get unit(): MarketUnitCode {
    return this._unit;
  }

  get displayName(): string {
    return this._displayName;
  }

  get assetType(): MarketAssetType {
    return this._assetType;
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
    symbol: string;
    baseAsset: string;
    quoteCurrency: string;
    unit: string;
    displayName: string;
    assetType?: MarketAssetType | undefined;
    isActive?: boolean | undefined;
    createdAt?: Date | undefined;
    updatedAt?: Date | undefined;
  }): Result<MarketInstrument, ValidationError> {
    const idResult = createMarketInstrumentId(params.id);
    if (idResult.isErr) return err(idResult.error);

    const symbol = params.symbol.trim().toUpperCase();
    if (!symbol || symbol.length > 32) {
      return err(new ValidationError('MarketInstrument symbol must be between 1 and 32 characters.'));
    }

    const baseAsset = params.baseAsset.trim().toUpperCase();
    if (!baseAsset || baseAsset.length > 16) {
      return err(new ValidationError('MarketInstrument baseAsset must be between 1 and 16 characters.'));
    }

    const currencyResult = parseCurrencyCode(params.quoteCurrency);
    if (currencyResult.isErr) return err(currencyResult.error);

    const unitResult = parseMarketUnit(params.unit);
    if (unitResult.isErr) return err(unitResult.error);

    const displayName = params.displayName.trim();
    if (!displayName || displayName.length > 128) {
      return err(new ValidationError('MarketInstrument displayName must be between 1 and 128 characters.'));
    }

    const now = new Date();
    return ok(
      new MarketInstrument(
        idResult.value,
        symbol,
        baseAsset,
        currencyResult.value,
        unitResult.value,
        displayName,
        params.assetType ?? 'PRECIOUS_METAL',
        params.isActive ?? true,
        params.createdAt ?? now,
        params.updatedAt ?? now
      )
    );
  }

  static reconstitute(
    id: MarketInstrumentId,
    symbol: string,
    baseAsset: string,
    quoteCurrency: CurrencyCode,
    unit: MarketUnitCode,
    displayName: string,
    assetType: MarketAssetType,
    isActive: boolean,
    createdAt: Date,
    updatedAt: Date
  ): MarketInstrument {
    return new MarketInstrument(
      id,
      symbol,
      baseAsset,
      quoteCurrency,
      unit,
      displayName,
      assetType,
      isActive,
      createdAt,
      updatedAt
    );
  }

  deactivate(): void {
    this._isActive = false;
    this._updatedAt = new Date();
  }

  activate(): void {
    this._isActive = true;
    this._updatedAt = new Date();
  }

  matches(symbolOrId: string): boolean {
    const normalized = symbolOrId.trim().toUpperCase();
    return this._symbol === normalized || this.id.toUpperCase() === normalized;
  }

  toDto(): MarketInstrumentDto {
    return {
      id: this.id,
      symbol: this._symbol,
      baseAsset: this._baseAsset,
      quoteCurrency: this._quoteCurrency,
      unit: this._unit,
      displayName: this._displayName,
      assetType: this._assetType,
      isActive: this._isActive,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
