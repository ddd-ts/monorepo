import { Serializer } from "../../../framework/serialization.registry";
import { Password } from "../domain/user";

export class PasswordSerializer implements Serializer<Password> {
  serialize(password: Password): string {
    return password.value;
  }

  deserialize(password: string): Password {
    return new Password(password);
  }
}
