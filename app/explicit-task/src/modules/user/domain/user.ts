import { TokenManager } from "./token-manager";

export class Email {
  constructor(readonly value: string) {}
}

export class Password {
  constructor(readonly value: string) {}

  equals(other: Password) {
    return this.value === other.value;
  }
}

export class User {
  constructor(readonly email: Email, readonly password: Password) {}

  static new(email: Email, password: Password) {
    return new User(email, password);
  }

  hasPassword(password: Password) {
    return this.password.equals(password);
  }

  generateToken(tokenManager: TokenManager) {
    return tokenManager.generate(this);
  }
}
