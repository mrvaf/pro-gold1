import { ValueObject } from '../../common/value-object.js';
import type { UserId } from '../iam/user.js';

export interface RfqMessageProps {
  readonly messageId: string;
  readonly senderId: UserId;
  readonly senderRole: 'CUSTOMER' | 'SELLER' | 'GOLDSMITH';
  readonly content: string;
  readonly sentAt: Date;
}

export class RfqMessage extends ValueObject<RfqMessageProps> {
  private constructor(props: RfqMessageProps) {
    super(props);
  }

  get messageId(): string {
    return this.props.messageId;
  }

  get senderId(): UserId {
    return this.props.senderId;
  }

  get senderRole(): 'CUSTOMER' | 'SELLER' | 'GOLDSMITH' {
    return this.props.senderRole;
  }

  get content(): string {
    return this.props.content;
  }

  get sentAt(): Date {
    return this.props.sentAt;
  }

  static create(props: RfqMessageProps): RfqMessage {
    return new RfqMessage(props);
  }

  toDto(): {
    messageId: string;
    senderId: string;
    senderRole: string;
    content: string;
    sentAt: string;
  } {
    return {
      messageId: this.props.messageId,
      senderId: this.props.senderId,
      senderRole: this.props.senderRole,
      content: this.props.content,
      sentAt: this.props.sentAt.toISOString(),
    };
  }
}
