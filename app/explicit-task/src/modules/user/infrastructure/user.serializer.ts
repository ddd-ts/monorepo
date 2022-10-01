import { Serializer } from "../../../framework/serialization.registry";
import { Email, Password, User } from "../domain/user";

export class UserSerializer implements Serializer<User> {
  constructor(
    private readonly emailSerializer: Serializer<Email>,
    private readonly passwordSerializer: Serializer<Password>
  ) {}

  serialize(user: User) {
    return {
      email: this.emailSerializer.serialize(user.email),
      password: this.passwordSerializer.serialize(user.password),
    };
  }

  deserialize(serialized: ReturnType<this["serialize"]>) {
    return new User(
      this.emailSerializer.deserialize(serialized.email),
      this.passwordSerializer.deserialize(serialized.password)
    );
  }
}
