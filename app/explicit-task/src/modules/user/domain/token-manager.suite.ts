import { TokenManager } from "./token-manager";
import { Email, Password, User } from "./user";

export function TokenManagerSuite(tokenManager: TokenManager) {
  it("should generate a valid token", () => {
    const user = new User(new Email("user@ddd.ts"), new Password("password"));
    const token = tokenManager.generate(user);
    const decoded = tokenManager.verify(token);
    expect(decoded).toEqual(user.email);
  });

  it("should throw if the token cannot be verified", () => {
    expect(() => tokenManager.verify("invalid")).toThrow();
  });
}
