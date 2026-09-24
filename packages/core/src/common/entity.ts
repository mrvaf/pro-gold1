import type { EntityId } from './id.js';

/**
 * Base class for all Domain Entities.
 * Entities are distinguished by their persistent identity rather than their attributes.
 */
export abstract class Entity<TId extends EntityId<string>> {
  protected readonly _id: TId;

  constructor(id: TId) {
    this._id = id;
  }

  get id(): TId {
    return this._id;
  }

  equals(other?: Entity<TId> | null): boolean {
    if (other === null || other === undefined) {
      return false;
    }
    if (this === other) {
      return true;
    }
    return this._id === other._id;
  }
}
