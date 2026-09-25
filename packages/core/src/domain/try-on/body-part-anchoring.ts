import { ValueObject } from '../../common/value-object.js';
import { ok, err, type Result } from '../../common/result.js';
import { InvalidAnchoringScaleError } from './try-on-errors.js';

export type BodyPartAnchoringType =
  | 'RING_FINGER'
  | 'WRIST'
  | 'EAR_LOBE'
  | 'NECK';

export interface BodyPartAnchoringProps {
  readonly bodyPart: BodyPartAnchoringType;
  readonly scaleFactor: number;        // Multiplier relative to nominal size (0.5 to 2.0)
  readonly anchorOffsetX: number;      // Offset in meters (-0.1 to 0.1)
  readonly anchorOffsetY: number;
  readonly anchorOffsetZ: number;
  readonly biometricFingerSizeMm?: number | undefined; // e.g. 14.0 mm to 24.0 mm for rings
  readonly wristCircumferenceMm?: number | undefined;  // e.g. 120 mm to 240 mm for bracelets
}

export class BodyPartAnchoring extends ValueObject<BodyPartAnchoringProps> {
  private constructor(props: BodyPartAnchoringProps) {
    super(props);
  }

  get bodyPart(): BodyPartAnchoringType {
    return this.props.bodyPart;
  }

  get scaleFactor(): number {
    return this.props.scaleFactor;
  }

  get anchorOffsetX(): number {
    return this.props.anchorOffsetX;
  }

  get anchorOffsetY(): number {
    return this.props.anchorOffsetY;
  }

  get anchorOffsetZ(): number {
    return this.props.anchorOffsetZ;
  }

  get biometricFingerSizeMm(): number | undefined {
    return this.props.biometricFingerSizeMm;
  }

  get wristCircumferenceMm(): number | undefined {
    return this.props.wristCircumferenceMm;
  }

  static create(props: BodyPartAnchoringProps): Result<BodyPartAnchoring, InvalidAnchoringScaleError> {
    if (props.scaleFactor < 0.5 || props.scaleFactor > 2.5) {
      return err(
        new InvalidAnchoringScaleError(props.bodyPart, props.scaleFactor, '0.5 to 2.5')
      );
    }

    if (props.biometricFingerSizeMm !== undefined) {
      if (props.biometricFingerSizeMm < 10 || props.biometricFingerSizeMm > 30) {
        return err(
          new InvalidAnchoringScaleError(
            'biometricFingerSizeMm',
            props.biometricFingerSizeMm,
            '10mm to 30mm'
          )
        );
      }
    }

    if (props.wristCircumferenceMm !== undefined) {
      if (props.wristCircumferenceMm < 100 || props.wristCircumferenceMm > 300) {
        return err(
          new InvalidAnchoringScaleError(
            'wristCircumferenceMm',
            props.wristCircumferenceMm,
            '100mm to 300mm'
          )
        );
      }
    }

    return ok(new BodyPartAnchoring(props));
  }

  toDto(): BodyPartAnchoringProps {
    return { ...this.props };
  }
}
