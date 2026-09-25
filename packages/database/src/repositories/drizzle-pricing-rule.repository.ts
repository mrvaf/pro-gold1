import { and, desc, eq, isNull, lte, or, gte } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import {
  type PricingRuleRepositoryPort,
  PricingRule,
  type PricingRuleId,
  type TenantId,
  type StoreId,
  createEntityId,
  type RoundingModeKey,
  type MakingChargeType,
  type MarginType,
  type TaxableBaseType,
} from '@v-gold/core';
import {
  pricingRulesTable,
  type PricingRuleRecord,
  type InsertPricingRuleRecord,
} from '../schema/pricing-rules.js';

export const toDomainPricingRule = (record: PricingRuleRecord): PricingRule => {
  const result = PricingRule.create({
    id: record.id,
    name: record.name,
    version: record.version,
    tenantId: record.tenantId ? createEntityId<TenantId>(record.tenantId) : undefined,
    storeId: record.storeId ? createEntityId<StoreId>(record.storeId) : undefined,
    effectiveFrom: record.effectiveFrom,
    effectiveTo: record.effectiveTo ?? undefined,
    config: {
      makingCharge: {
        type: record.makingChargeType as MakingChargeType,
        rate: record.makingChargeRate,
      },
      margin: {
        type: record.marginType as MarginType,
        rate: record.marginRate,
      },
      tax: {
        taxableBase: record.taxableBase as TaxableBaseType,
        rate: record.taxRate,
      },
      roundingMode: record.roundingMode as RoundingModeKey,
      roundingScale: record.roundingScale ?? undefined,
    },
    isReferenceSample: record.isReferenceSample ?? false,
    specificationSource: record.specificationSource ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt ?? undefined,
  });

  if (result.isErr) {
    throw new Error(`Corrupted pricing rule record in DB (${record.id}): ${result.error.message}`);
  }

  return result.value;
};

export const toDatabasePricingRule = (rule: PricingRule): InsertPricingRuleRecord => ({
  id: rule.id,
  name: rule.name,
  version: rule.version,
  tenantId: rule.tenantId ?? null,
  storeId: rule.storeId ?? null,
  effectiveFrom: rule.effectiveFrom,
  effectiveTo: rule.effectiveTo ?? null,
  makingChargeType: rule.config.makingCharge.type,
  makingChargeRate: rule.config.makingCharge.rate,
  marginType: rule.config.margin.type,
  marginRate: rule.config.margin.rate,
  taxableBase: rule.config.tax.taxableBase,
  taxRate: rule.config.tax.rate,
  roundingMode: rule.config.roundingMode,
  roundingScale: rule.config.roundingScale ?? null,
  isReferenceSample: rule.isReferenceSample,
  specificationSource: rule.specificationSource ?? null,
  createdAt: rule.createdAt,
  updatedAt: rule.updatedAt ?? null,
});

export class DrizzlePricingRuleRepository implements PricingRuleRepositoryPort {
  constructor(private readonly db: PgDatabase<any, any, any>) {}

  async save(rule: PricingRule): Promise<void> {
    const record = toDatabasePricingRule(rule);
    await this.db
      .insert(pricingRulesTable)
      .values(record)
      .onConflictDoNothing();
  }

  async findById(id: PricingRuleId, tenantId?: TenantId): Promise<PricingRule | null> {
    const conditions = [eq(pricingRulesTable.id, id)];

    if (tenantId !== undefined) {
      conditions.push(
        or(
          eq(pricingRulesTable.tenantId, tenantId),
          isNull(pricingRulesTable.tenantId)
        )!
      );
    }

    const records = await this.db
      .select()
      .from(pricingRulesTable)
      .where(and(...conditions))
      .limit(1);

    const record = records[0];
    return record ? toDomainPricingRule(record) : null;
  }

  async findEffective(params: {
    atDate: Date;
    tenantId?: TenantId | undefined;
    ruleId?: PricingRuleId | undefined;
    includeReferenceSamples?: boolean | undefined;
  }): Promise<PricingRule | null> {
    const conditions = [
      lte(pricingRulesTable.effectiveFrom, params.atDate),
      or(
        isNull(pricingRulesTable.effectiveTo),
        gte(pricingRulesTable.effectiveTo, params.atDate)
      )!,
    ];

    // Unless explicitly requested, reference sample rules are NEVER selected as silent defaults
    if (!params.includeReferenceSamples && !params.ruleId) {
      conditions.push(eq(pricingRulesTable.isReferenceSample, false));
    }

    if (params.ruleId) {
      conditions.push(eq(pricingRulesTable.id, params.ruleId));
    }

    if (params.tenantId) {
      conditions.push(
        or(
          eq(pricingRulesTable.tenantId, params.tenantId),
          isNull(pricingRulesTable.tenantId)
        )!
      );
    } else {
      conditions.push(isNull(pricingRulesTable.tenantId));
    }

    const records = await this.db
      .select()
      .from(pricingRulesTable)
      .where(and(...conditions))
      .orderBy(desc(pricingRulesTable.effectiveFrom))
      .limit(1);

    const record = records[0];
    return record ? toDomainPricingRule(record) : null;
  }

  async listByTenant(
    tenantId?: TenantId,
    includeReferenceSamples: boolean = false
  ): Promise<PricingRule[]> {
    const conditions = [];

    if (tenantId) {
      conditions.push(
        or(eq(pricingRulesTable.tenantId, tenantId), isNull(pricingRulesTable.tenantId))!
      );
    } else {
      conditions.push(isNull(pricingRulesTable.tenantId));
    }

    if (!includeReferenceSamples) {
      conditions.push(eq(pricingRulesTable.isReferenceSample, false));
    }

    const records = await this.db
      .select()
      .from(pricingRulesTable)
      .where(and(...conditions))
      .orderBy(desc(pricingRulesTable.createdAt));

    return records.map(toDomainPricingRule);
  }

  async count(): Promise<number> {
    const records = await this.db.select().from(pricingRulesTable);
    return records.length;
  }
}
