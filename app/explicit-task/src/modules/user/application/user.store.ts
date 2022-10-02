import { Email, User } from "../domain/user";

export interface UserStore {
  load(email: Email): Promise<User | undefined>;
  save(user: User): Promise<void>;
}
