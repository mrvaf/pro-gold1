import { Decimal } from 'decimal.js';
import { Entity } from '../../common/entity.js';
import { createEntityId, type EntityId } from '../../common/id.js';
import { ValidationError } from '../../common/errors.js';
import { err, ok, type Result } from '../../common/result.js';
import type { TenantId } from '../tenant/tenant.js';
import type { StoreId } from '../tenant/store.js';
import { ROUNDING_MODES, type RoundingModeKey } from '../finance/rounding-policy.js';
import type { PricingRuleConfig } from './pricing-types.js';

export type PricingRuleId = EntityId<'PricingRule'>;

export interface CreatePricingRuleProps {
  id?: string | undefined;
  name: string;
  version?: string | undefined;
  tenantId?: TenantId | undefined;
  storeId?: StoreId | undefined;
  effectiveFrom?: Date | undefined;
  effectiveTo?: Date | undefined;
  config: PricingRuleConfig;
  createdAt?: Date | undefined;
  updatedAt?: Date | undefined;
}

export interface PricingRuleDto {
  id: string;
  name: string;
  version: string;
  tenantId?: string | undefined;
  storeId?: string | undefined;
  effectiveFrom: string;
  effectiveTo?: string | undefined;
  config: {
    makingCharge: {
      type: string;
      rate: string;
    };
    margin: {
      type: string;
      rate: string;
    };
    tax: {
      taxableBase: string;
      rate: string;
    };
    roundingMode: string;
    roundingScale?: number | undefined;
  };
  createdAt: string;
}

export class PricingRule extends Entity<PricingRuleId> {
  private readonly _name: string;
  private readonly _version: string;
  private readonly _tenantId?: TenantId | undefined;
  private readonly _storeId?: StoreId | undefined;
  private readonly _effectiveFrom: Date;
  private readonly _effectiveTo?: Date | undefined;
  private readonly _config: PricingRuleConfig;
  private readonly _createdAt: Date;
  private readonly _updatedAt?: Date | undefined;

  private constructor(
    id: PricingRuleId,
    name: string,
    version: string,
    effectiveFrom: Date,
    config: PricingRuleConfig,
    createdAt: Date,
    tenantId?: TenantId | undefined,
    storeId?: StoreId | undefined,
    effectiveTo?: Date | undefined,
    updatedAt?: Date | undefined
  ) {
    super(id);
    this._name = name;
    this._version = version;
    this._effectiveFrom = effectiveFrom;
    this._config = config;
    this._createdAt = createdAt;
    this._tenantId = tenantId;
    this._storeId = storeId;
    this._effectiveTo = effectiveTo;
    this._updatedAt = updatedAt;
  }

  get name(): string {
    return this._name;
  }

  get version(): string {
    return this._version;
  }

  get tenantId(): TenantId | undefined {
    return this._tenantId;
  }

  get storeId(): StoreId | undefined {
    return this._storeId;
  }

  get effectiveFrom(): Date {
    return this._effectiveFrom;
  }

  get effectiveTo(): Date | undefined {
    return this._effectiveTo;
  }

  get config(): PricingRuleConfig {
    return this._config;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date | undefined {
    return this._updatedAt;
  }

  isSystemRule(): boolean {
    return this._tenantId === undefined;
  }

  isEffectiveAt(date: Date): boolean {
    const time = date.getTime();
    if (time < this._effectiveFrom.getTime()) {
      return false;
    }
    if (this._effectiveTo !== undefined && time > this._effectiveTo.getTime()) {
      return false;
    }
    return true;
  }

  static create(params: CreatePricingRuleProps): Result<PricingRule, ValidationError> {
    if (!params.name || params.name.trim() === '') {
      return err(new ValidationError('Pricing rule name cannot be empty.'));
    }

    const version = params.version?.trim() || '1';
    const { makingCharge, margin, tax, roundingMode, roundingScale } = params.config;

    try {
      const chargeRate = new Decimal(makingCharge.rate);
      if (!chargeRate.isFinite() || chargeRate.isNaN() || chargeRate.lessThan(0)) {
        return err(
          new ValidationError(
            `Making charge rate must be a non-negative finite number: "${makingCharge.rate}"`
          )
        );
      }
    } catch {
      return err(new ValidationError(`Invalid making charge rate: "${makingCharge.rate}"`));
    }

    try {
      const marginRate = new Decimal(margin.rate);
      if (!marginRate.isFinite() || marginRate.isNaN() || marginRate.lessThan(0)) {
        return err(
          new ValidationError(
            `Margin rate must be a non-negative finite number: "${margin.rate}"`
          )
        );
      }
    } catch {
      return err(new ValidationError(`Invalid margin rate: "${margin.rate}"`));
    }

    try {
      const taxRate = new Decimal(tax.rate);
      if (!taxRate.isFinite() || taxRate.isNaN() || taxRate.lessThan(0)) {
        return err(
          new ValidationError(`Tax rate must be a non-negative finite number: "${tax.rate}"`)
        );
      }
    } catch {
      return err(new ValidationError(`Invalid tax rate: "${tax.rate}"`));
    }

    if (!(roundingMode in ROUNDING_MODES)) {
      return err(
        new ValidationError(
          `Invalid rounding mode: "${roundingMode}". Supported: ${Object.keys(ROUNDING_MODES).join(', ')}`
        )
      );
    }

    if (roundingScale !== undefined) {
      if (!Number.isInteger(roundingScale) || roundingScale < 0) {
        return err(new ValidationError(`Rounding scale must be a non-negative integer: ${roundingScale}`));
      }
    }

    const effectiveFrom = params.effectiveFrom ?? new Date(0);
    if (params.effectiveTo && params.effectiveTo.getTime() <= effectiveFrom.getTime()) {
      return err(new ValidationError('effectiveTo must be strictly after effectiveFrom.'));
    }

    const ruleId = createEntityId<PricingRuleId>(params.id ?? `rule_${Date.now()}`);
    return ok(
      new PricingRule(
        ruleId,
        params.name.trim(),
        version,
        effectiveFrom,
        params.config,
        params.createdAt ?? new Date(),
        params.tenantId,
        params.storeId,
        params.effectiveTo,
        params.updatedAt
      )
    );
  }

  toDto(): PricingRuleDto {
    return {
      id: this._id,
      name: this._name,
      version: this._version,
      tenantId: this._tenantId,
      storeId: this._storeId,
      effectiveFrom: this._effectiveFrom.toISOString(),
      effectiveTo: this._effectiveTo?.toISOString(),
      config: {
        makingCharge: {
          type: this._config.makingCharge.type,
          rate: this._config.makingCharge.rate,
        },
        margin: {
          type: this._config.margin.type,
          rate: this._config.margin.rate,
        },
        tax: {
          taxableBase: this._config.tax.taxableBase,
          rate: this._config.tax.rate,
        },
        roundingMode: this._config.roundingMode,
        roundingScale: this._config.roundingScale,
      },
      createdAt: this._createdAt.toISOString(),
    };
  }
}
