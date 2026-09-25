import { ValueObject } from '../../common/value-object.js';
import { Result, ok, err } from '../../common/result.js';

export interface StyleDnaProps {
  aestheticStyle: string; // e.g. "MINIMALIST", "PERSIAN_BAROQUE", "CONTEMPORARY", "ART_DECO"
  primaryMotif: string; // e.g. "GEOMETRIC", "ARABESQUE", "FLORAL", "ABSTRACT"
  finishPreference: string; // e.g. "HIGH_POLISH", "SATIN", "MATTE", "HAMMERED"
  symmetryScore: number; // 0.0 to 1.0
  complexityScore: number; // 0.0 to 1.0
  tags: readonly string[];
}

export class StyleDna extends ValueObject<StyleDnaProps> {
  private constructor(props: StyleDnaProps) {
    super(props);
  }

  static create(props: StyleDnaProps): Result<StyleDna, string> {
    if (!props.aestheticStyle || props.aestheticStyle.trim().length === 0) {
      return err('Aesthetic style cannot be empty');
    }
    if (!props.primaryMotif || props.primaryMotif.trim().length === 0) {
      return err('Primary motif cannot be empty');
    }
    if (props.symmetryScore < 0 || props.symmetryScore > 1) {
      return err('Symmetry score must be between 0.0 and 1.0');
    }
    if (props.complexityScore < 0 || props.complexityScore > 1) {
      return err('Complexity score must be between 0.0 and 1.0');
    }

    return ok(
      new StyleDna({
        ...props,
        aestheticStyle: props.aestheticStyle.trim().toUpperCase(),
        primaryMotif: props.primaryMotif.trim().toUpperCase(),
        finishPreference: props.finishPreference?.trim().toUpperCase() || 'HIGH_POLISH',
        tags: Object.freeze([...(props.tags || [])]),
      })
    );
  }

  get aestheticStyle(): string {
    return this.props.aestheticStyle;
  }

  get primaryMotif(): string {
    return this.props.primaryMotif;
  }

  get finishPreference(): string {
    return this.props.finishPreference;
  }

  get symmetryScore(): number {
    return this.props.symmetryScore;
  }

  get complexityScore(): number {
    return this.props.complexityScore;
  }

  get tags(): readonly string[] {
    return this.props.tags;
  }
}
