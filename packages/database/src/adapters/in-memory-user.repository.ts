import type { UserRepositoryPort, User, UserId, Email } from '@v-gold/core';
import { InMemoryRepository } from '../in-memory-store.js';

export class InMemoryUserRepository extends InMemoryRepository<User, UserId> implements UserRepositoryPort {
  async findByEmail(email: Email): Promise<User | null> {
    const target = email.value.toLowerCase();
    for (const user of this.items.values()) {
      if (user.email.value.toLowerCase() === target) {
        return user;
      }
    }
    return null;
  }
}
