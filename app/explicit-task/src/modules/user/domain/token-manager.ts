import { Email, User } from "./user";

export interface TokenManager {
  generate(user: User): string;
  verify(token: string): Email;
}
