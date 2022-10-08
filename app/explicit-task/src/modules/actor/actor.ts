import { Command } from "@ddd-ts/cqrs";

type ActorType = "Anonymous" | "User" | "Context";

export class Actor {
  constructor(
    public readonly type: ActorType,
    public readonly identity: string
  ) {}

  isAuthenticated() {
    return this.type === "User";
  }
}

export interface AuthCommand extends Command {
  actor: Actor;
}
