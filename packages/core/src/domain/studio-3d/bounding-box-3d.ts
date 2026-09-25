import { ValueObject } from '../../common/value-object.js';
import { ok, err, type Result } from '../../common/result.js';
import { Invalid3DScaleError } from './studio-3d-errors.js';

export interface BoundingBox3DProps {
  readonly widthMeters: number;  // X-axis (e.g. 0.02m for 20mm ring)
  readonly heightMeters: number; // Y-axis
  readonly depthMeters: number;  // Z-axis
}

export class BoundingBox3D extends ValueObject<BoundingBox3DProps> {
  private constructor(props: BoundingBox3DProps) {
    super(props);
  }

  get widthMeters(): number {
    return this.props.widthMeters;
  }

  get heightMeters(): number {
    return this.props.heightMeters;
  }

  get depthMeters(): number {
    return this.props.depthMeters;
  }

  static create(props: BoundingBox3DProps): Result<BoundingBox3D, Invalid3DScaleError> {
    const MIN_SCALE = 0.001; // 1 mm
    const MAX_SCALE = 1.0;   // 1000 mm (1 meter)

    if (props.widthMeters < MIN_SCALE || props.widthMeters > MAX_SCALE) {
      return err(new Invalid3DScaleError('X/width', props.widthMeters));
    }
    if (props.heightMeters < MIN_SCALE || props.heightMeters > MAX_SCALE) {
      return err(new Invalid3DScaleError('Y/height', props.heightMeters));
    }
    if (props.depthMeters < MIN_SCALE || props.depthMeters > MAX_SCALE) {
      return err(new Invalid3DScaleError('Z/depth', props.depthMeters));
    }

    return ok(new BoundingBox3D(props));
  }

  toDto(): BoundingBox3DProps {
    return { ...this.props };
  }
}
