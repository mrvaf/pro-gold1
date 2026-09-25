import { ValueObject } from '../../common/value-object.js';

export interface PbrMaterialMapProps {
  readonly metalnessFactor: number; // 0.0 to 1.0 (typically 1.0 for gold/platinum)
  readonly roughnessFactor: number; // 0.0 to 1.0 (e.g. 0.1 for high-polish, 0.4 for brushed)
  readonly baseColorHex: string;    // e.g. '#FFD700' for yellow gold, '#E5E4E2' for platinum
  readonly normalMapUrl?: string | undefined;
  readonly occlusionMapUrl?: string | undefined;
  readonly emissiveHex?: string | undefined;
}

export class PbrMaterialMap extends ValueObject<PbrMaterialMapProps> {
  private constructor(props: PbrMaterialMapProps) {
    super(props);
  }

  get metalnessFactor(): number {
    return this.props.metalnessFactor;
  }

  get roughnessFactor(): number {
    return this.props.roughnessFactor;
  }

  get baseColorHex(): string {
    return this.props.baseColorHex;
  }

  get normalMapUrl(): string | undefined {
    return this.props.normalMapUrl;
  }

  get occlusionMapUrl(): string | undefined {
    return this.props.occlusionMapUrl;
  }

  get emissiveHex(): string | undefined {
    return this.props.emissiveHex;
  }

  static create(props: PbrMaterialMapProps): PbrMaterialMap {
    const clampedMetalness = Math.max(0, Math.min(1, props.metalnessFactor));
    const clampedRoughness = Math.max(0, Math.min(1, props.roughnessFactor));

    return new PbrMaterialMap({
      ...props,
      metalnessFactor: clampedMetalness,
      roughnessFactor: clampedRoughness,
    });
  }

  toDto(): PbrMaterialMapProps {
    return { ...this.props };
  }
}
