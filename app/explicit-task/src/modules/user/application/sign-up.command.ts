import { Email, Password, User } from "../domain/user";

interface UserStore {
  load(email: Email): Promise<User | undefined>;
  save(user: User): Promise<void>;
}

export class SignUpCommand {
  type = "SignUp" as const;
  constructor(readonly email: Email, readonly password: Password) {}
}

export class SignUpCommandHandler {
  on = ["SignUp"] as const;
  constructor(private readonly userStore: UserStore) {}

  async execute(command: SignUpCommand) {
    const { email, password } = command;
    const existing = await this.userStore.load(email);
    if (existing) {
      throw new Error("User already exists");
    }
    const user = User.new(email, password);
    await this.userStore.save(user);
  }
}
