import { sign, verify } from "jsonwebtoken";
import { Email, User } from "../domain/user";

interface JwtPayload {
  email: string;
}

export class JwtTokenManager {
  secret = "secret";

  generate(user: User): string {
    const payload: JwtPayload = { email: user.email.value };
    return sign(payload, this.secret, { expiresIn: "1h" });
  }

  verify(token: string): Email {
    const payload = verify(token, this.secret);

    if (typeof payload === "string") {
      throw new Error("Invalid token");
    }

    return new Email((payload as JwtPayload).email);
  }
}
