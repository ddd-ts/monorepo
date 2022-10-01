import { Serializer } from "../../../framework/serialization.registry";
import { SignUpCommand } from "../application/sign-up.command";
import { Email, Password } from "../domain/user";

export class SignUpCommandSerializer implements Serializer<SignUpCommand> {
  constructor(
    private readonly emailSerializer: Serializer<Email>,
    private readonly passwordSerializer: Serializer<Password>
  ) {}

  serialize(command: SignUpCommand) {
    return {
      type: "SignUp",
      email: this.emailSerializer.serialize(command.email),
      password: this.emailSerializer.serialize(command.password),
    };
  }

  deserialize(serialized: ReturnType<this["serialize"]>): SignUpCommand {
    return new SignUpCommand(
      this.emailSerializer.deserialize(serialized.email),
      this.passwordSerializer.deserialize(serialized.password)
    );
  }
}
