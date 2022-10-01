import { Serializer } from "../../../framework/serialization.registry";
import { Email } from "../domain/user";

export class EmailSerializer implements Serializer<Email> {
  serialize(email: Email): string {
    return email.value;
  }

  deserialize(email: string): Email {
    return new Email(email);
  }
}
