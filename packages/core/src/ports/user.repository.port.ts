import type { User, UserId } from '../domain/iam/user.js';
import type { Email } from '../domain/iam/email.js';

export interface UserRepositoryPort {
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  save(user: User): Promise<void>;
  delete(id: UserId): Promise<void>;
}
