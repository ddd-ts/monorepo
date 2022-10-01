import { InMemoryExplicitAggregateStore } from "../../../framework/in-memory.explicit.aggregate.store";
import { User } from "../domain/user";

export class InMemoryUserStore extends InMemoryExplicitAggregateStore<User> {
  identify(user: User) {
    return user.email;
  }
}
