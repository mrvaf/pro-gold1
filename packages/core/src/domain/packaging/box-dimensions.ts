import { Result, ok, err } from '../../common/result.js';
import { InvalidPackagingDimensionsError } from './packaging-errors.js';

export interface BoxDimensionsProps {
  widthMm: number;
  lengthMm: number;
  heightMm: number;
}

export class BoxDimensions {
  private constructor(
    private readonly _widthMm: number,
    private readonly _lengthMm: number,
    private readonly _heightMm: number
  ) {}

  static create(props: BoxDimensionsProps): Result<BoxDimensions, InvalidPackagingDimensionsError> {
    const { widthMm, lengthMm, heightMm } = props;

    if (!Number.isFinite(widthMm) || widthMm < 20 || widthMm > 500) {
      return err(
        new InvalidPackagingDimensionsError(`Box width must be between 20mm and 500mm, got ${widthMm}`)
      );
    }

    if (!Number.isFinite(lengthMm) || lengthMm < 20 || lengthMm > 500) {
      return err(
        new InvalidPackagingDimensionsError(`Box length must be between 20mm and 500mm, got ${lengthMm}`)
      );
    }

    if (!Number.isFinite(heightMm) || heightMm < 10 || heightMm > 300) {
      return err(
        new InvalidPackagingDimensionsError(`Box height must be between 10mm and 300mm, got ${heightMm}`)
      );
    }

    return ok(new BoxDimensions(widthMm, lengthMm, heightMm));
  }

  get widthMm(): number {
    return this._widthMm;
  }

  get lengthMm(): number {
    return this._lengthMm;
  }

  get heightMm(): number {
    return this._heightMm;
  }

  get surfaceAreaMm2(): number {
    return 2 * (this._widthMm * this._lengthMm + this._widthMm * this._heightMm + this._lengthMm * this._heightMm);
  }

  get volumeMm3(): number {
    return this._widthMm * this._lengthMm * this._heightMm;
  }

  toJSON() {
    return {
      widthMm: this._widthMm,
      lengthMm: this._lengthMm,
      heightMm: this._heightMm,
      surfaceAreaMm2: this.surfaceAreaMm2,
      volumeMm3: this.volumeMm3,
    };
  }
}
