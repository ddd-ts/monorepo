import { Email, Password, User } from "../domain/user";
import { EmailSerializer } from "../infrastructure/email.serializer";
import { InMemoryUserStore } from "../infrastructure/in-memory.user.store";
import { JwtTokenManager } from "../infrastructure/jwt.token-manager";
import { PasswordSerializer } from "../infrastructure/password.serializer";
import { UserSerializer } from "../infrastructure/user.serializer";
import { SignInCommand, SignInCommandHandler } from "./sign-in.command";
import { SignUpCommand, SignUpCommandHandler } from "./sign-up.command";

describe("SignInCommand", () => {
  function createHandler() {
    const store = new InMemoryUserStore(
      new UserSerializer(new EmailSerializer(), new PasswordSerializer())
    );

    const tokenManager = new JwtTokenManager();

    const handler = new SignInCommandHandler(store, tokenManager);
    return { handler, store, tokenManager };
  }

  it("returns a token allowing to authenticate", async () => {
    const { handler, store, tokenManager } = createHandler();

    const user = new User(new Email("user@ddd.ts"), new Password("password"));
    await store.save(user);

    const command = new SignInCommand(user.email, user.password);
    const token = await handler.execute(command);

    expect(tokenManager.verify(token)).toEqual(user.email);
  });

  it("throws an error if the user is not known", async () => {
    const { handler } = createHandler();

    const command = new SignInCommand(
      new Email("unkwnown@ddd.ts"),
      new Password("password")
    );

    await expect(handler.execute(command)).rejects.toThrowError("Unknown user");
  });

  it("throws an error if the password is invalid", async () => {
    const { handler, store } = createHandler();

    const user = new User(new Email("user@ddd.ts"), new Password("password"));
    await store.save(user);

    const command = new SignInCommand(user.email, new Password("invalid"));

    await expect(handler.execute(command)).rejects.toThrowError(
      "Invalid password"
    );
  });
});
