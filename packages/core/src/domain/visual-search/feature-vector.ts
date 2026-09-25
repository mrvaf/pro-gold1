import { ValueObject } from '../../common/value-object.js';
import { ok, err, type Result } from '../../common/result.js';
import { InvalidFeatureVectorError } from './visual-search-errors.js';

export interface FeatureVectorProps {
  dimensions: number;
  values: number[];
}

export class FeatureVector extends ValueObject<FeatureVectorProps> {
  private readonly _dimensions: number;
  private readonly _values: readonly number[];

  private constructor(values: number[]) {
    super({
      dimensions: values.length,
      values: [...values],
    });
    this._dimensions = values.length;
    this._values = Object.freeze([...values]);
  }

  get dimensions(): number {
    return this._dimensions;
  }

  get values(): readonly number[] {
    return this._values;
  }

  static create(values: number[]): Result<FeatureVector, InvalidFeatureVectorError> {
    if (!Array.isArray(values) || values.length === 0) {
      return err(new InvalidFeatureVectorError('Vector cannot be empty.'));
    }
    if (values.length < 8 || values.length > 2048) {
      return err(
        new InvalidFeatureVectorError(
          `Vector dimension ${values.length} out of bounds (allowed: 8 - 2048).`
        )
      );
    }
    for (let i = 0; i < values.length; i++) {
      const val = values[i];
      if (typeof val !== 'number' || !Number.isFinite(val)) {
        return err(
          new InvalidFeatureVectorError(`Vector element at index ${i} is not a finite number.`)
        );
      }
    }

    return ok(new FeatureVector(values));
  }

  /**
   * Computes cosine similarity between this vector and another vector.
   * Returns a score between -1 and 1 (typically 0 to 1 for normalized positive features).
   */
  cosineSimilarity(other: FeatureVector): Result<number, InvalidFeatureVectorError> {
    if (this._dimensions !== other.dimensions) {
      return err(
        new InvalidFeatureVectorError(
          `Dimension mismatch: vector A has ${this._dimensions} dims, vector B has ${other.dimensions} dims.`
        )
      );
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < this._dimensions; i++) {
      const a = this._values[i] ?? 0;
      const b = other.values[i] ?? 0;
      dotProduct += a * b;
      normA += a * a;
      normB += b * b;
    }

    if (normA === 0 || normB === 0) {
      return ok(0);
    }

    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    // Clamp to [-1, 1] due to floating point inaccuracies
    return ok(Math.max(-1, Math.min(1, similarity)));
  }

  toDto(): FeatureVectorProps {
    return {
      dimensions: this._dimensions,
      values: [...this._values],
    };
  }
}
