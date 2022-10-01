export interface Command {
  readonly type: string;
}

export interface CommandHandler<E extends Command = Command> {
  readonly on: readonly E["type"][];
  execute(command: E): any;
}

export interface CommandBusMiddleware<
  H extends CommandHandler = CommandHandler
> {
  (command: Command, handler: H, next: () => ReturnType<H["execute"]>): any;
}
