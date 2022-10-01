import { Email, Password, User } from "../domain/user";
import { EmailSerializer } from "../infrastructure/email.serializer";
import { InMemoryUserStore } from "../infrastructure/in-memory.user.store";
import { PasswordSerializer } from "../infrastructure/password.serializer";
import { UserSerializer } from "../infrastructure/user.serializer";
import { SignUpCommand, SignUpCommandHandler } from "./sign-up.command";

describe("SignUpCommand", () => {
  function createHandler() {
    const store = new InMemoryUserStore(
      new UserSerializer(new EmailSerializer(), new PasswordSerializer())
    );
    const handler = new SignUpCommandHandler(store);
    return { handler, store };
  }

  it("registers the new user", async () => {
    const { handler, store } = createHandler();
    const command = new SignUpCommand(
      new Email("user@ddd.ts"),
      new Password("password")
    );
    await handler.execute(command);

    const user = await store.load(command.email);
    expect(user).toEqual(new User(command.email, command.password));
  });

  it("throws an error if the user already exists", async () => {
    const { handler } = createHandler();
    const command = new SignUpCommand(
      new Email("user@ddd.ts"),
      new Password("password")
    );
    await handler.execute(command);
    await expect(handler.execute(command)).rejects.toThrowError(
      "User already exists"
    );
  });
});
