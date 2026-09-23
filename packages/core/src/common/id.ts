/**
 * Generic branded Entity Identifier.
 */
declare const __brand: unique symbol;

export type EntityId<TBrand extends string = string> = string & {
  readonly [__brand]: TBrand;
};

export const createEntityId = <TId extends string = EntityId<string>>(rawId: string): TId => {
  if (!rawId || rawId.trim().length === 0) {
    throw new Error('Entity ID cannot be empty');
  }
  return rawId.trim() as TId;
};
