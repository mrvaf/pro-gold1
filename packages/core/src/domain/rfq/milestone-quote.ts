import { ValueObject } from '../../common/value-object.js';
import type { Money } from '../finance/money.js';

export interface MilestoneQuoteProps {
  readonly milestoneId: string;
  readonly title: string;
  readonly description: string;
  readonly targetDays: number;
  readonly costAmount: Money;
}

export class MilestoneQuote extends ValueObject<MilestoneQuoteProps> {
  private constructor(props: MilestoneQuoteProps) {
    super(props);
  }

  get milestoneId(): string {
    return this.props.milestoneId;
  }

  get title(): string {
    return this.props.title;
  }

  get description(): string {
    return this.props.description;
  }

  get targetDays(): number {
    return this.props.targetDays;
  }

  get costAmount(): Money {
    return this.props.costAmount;
  }

  static create(props: MilestoneQuoteProps): MilestoneQuote {
    return new MilestoneQuote(props);
  }

  toDto(): {
    milestoneId: string;
    title: string;
    description: string;
    targetDays: number;
    costAmount: string;
    currency: string;
  } {
    return {
      milestoneId: this.props.milestoneId,
      title: this.props.title,
      description: this.props.description,
      targetDays: this.props.targetDays,
      costAmount: this.props.costAmount.amount.toString(),
      currency: this.props.costAmount.currency,
    };
  }
}
