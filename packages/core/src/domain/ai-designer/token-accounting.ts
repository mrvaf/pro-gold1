import { ValueObject } from '../../common/value-object.js';
import { ValidationError } from '../../common/errors.js';
import { ok, err, type Result } from '../../common/result.js';

export interface TokenAccountingProps {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
  provider: string;
}

export class TokenAccounting extends ValueObject<TokenAccountingProps> {
  private constructor(props: TokenAccountingProps) {
    super(props);
  }

  get promptTokens(): number {
    return this.props.promptTokens;
  }

  get completionTokens(): number {
    return this.props.completionTokens;
  }

  get totalTokens(): number {
    return this.props.totalTokens;
  }

  get model(): string {
    return this.props.model;
  }

  get provider(): string {
    return this.props.provider;
  }

  static create(props: TokenAccountingProps): Result<TokenAccounting, ValidationError> {
    if (props.promptTokens < 0 || props.completionTokens < 0 || props.totalTokens < 0) {
      return err(new ValidationError('Token count cannot be negative.'));
    }
    if (props.totalTokens !== props.promptTokens + props.completionTokens) {
      return err(new ValidationError('Total tokens must equal promptTokens + completionTokens.'));
    }
    if (!props.model || props.model.trim().length === 0) {
      return err(new ValidationError('Model name is required for token accounting.'));
    }
    if (!props.provider || props.provider.trim().length === 0) {
      return err(new ValidationError('Provider name is required for token accounting.'));
    }

    return ok(new TokenAccounting({ ...props }));
  }

  static zero(provider = 'none', model = 'none'): TokenAccounting {
    return new TokenAccounting({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      provider,
      model,
    });
  }

  toDto(): TokenAccountingProps {
    return { ...this.props };
  }
}
