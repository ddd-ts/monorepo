export class Email {
  constructor(readonly value: string) {}
}

export class Password {
  constructor(readonly value: string) {}
}

export class User {
  constructor(readonly email: Email, readonly password: Password) {}

  static new(email: Email, password: Password) {
    return new User(email, password);
  }
}
