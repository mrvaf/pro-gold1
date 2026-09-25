import {
  type VisualFeatureExtractorPort,
  type VisualSearchImage,
  FeatureVector,
  AiProviderUnavailableError,
  err,
  ok,
  type Result,
} from '@v-gold/core';

export interface MockVisualFeatureExtractorOptions {
  readonly defaultDimensions?: number;
  readonly simulateTimeout?: boolean;
}

export class MockVisualFeatureExtractorAdapter implements VisualFeatureExtractorPort {
  private readonly defaultDimensions: number;
  private readonly simulateTimeout: boolean;
  public callCount = 0;

  constructor(options: MockVisualFeatureExtractorOptions = {}) {
    this.defaultDimensions = options.defaultDimensions ?? 64;
    this.simulateTimeout = options.simulateTimeout ?? false;
  }

  async extractFeatures(
    image: VisualSearchImage
  ): Promise<Result<FeatureVector, never>> {
    this.callCount++;

    if (this.simulateTimeout) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Deterministic embedding derived from image string characters
    const values: number[] = [];
    const seed = image.filename.length + image.sizeBytes;
    for (let i = 0; i < this.defaultDimensions; i++) {
      values.push(Math.sin(seed + i) * 0.5 + 0.5);
    }

    return ok(FeatureVector.create(values).unwrap());
  }
}

export class UnavailableVisualFeatureExtractorAdapter implements VisualFeatureExtractorPort {
  constructor(private readonly reason: string = 'No live visual feature extraction provider configured.') {}

  async extractFeatures(
    _image: VisualSearchImage
  ): Promise<Result<FeatureVector, AiProviderUnavailableError>> {
    return err(new AiProviderUnavailableError(this.reason));
  }
}
