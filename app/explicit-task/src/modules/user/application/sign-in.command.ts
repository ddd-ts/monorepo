import { TokenManager } from "../domain/token-manager";
import { Email, Password } from "../domain/user";
import { UserStore } from "./user.store";

export class SignInCommand {
  type = "SignIn" as const;
  constructor(readonly email: Email, readonly password: Password) {}
}

export class SignInCommandHandler {
  on = ["SignIn"] as const;
  constructor(
    private readonly userStore: UserStore,
    private readonly tokenManager: TokenManager
  ) {}

  async execute(command: SignInCommand) {
    const { email, password } = command;

    const user = await this.userStore.load(email);

    if (!user) {
      throw new Error("Unknown user");
    }

    if (!user.hasPassword(password)) {
      throw new Error("Invalid password");
    }

    return user.generateToken(this.tokenManager);
  }
}
