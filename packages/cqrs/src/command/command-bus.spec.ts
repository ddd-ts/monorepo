import { CommandBus } from "./command-bus";

describe("CommandBus", () => {
  class AddTaskCommand {
    type = "AddTask";
    constructor(public readonly title: string) {}
  }

  class AddTaskCommandHandler {
    on = ["AddTask"] as const;
    constructor(private readonly mock: jest.Mock) {}
    execute(command: AddTaskCommand) {
      this.mock();
      return command.title;
    }
  }

  class RemoveTaskCommand {
    type = "RemoveTask";
    constructor(public readonly title: string) {}
  }

  class RemoveTaskCommandHandler {
    on = ["RemoveTask"] as const;
    constructor(private readonly mock: jest.Mock) {}
    execute(command: RemoveTaskCommand) {
      this.mock();
    }
  }

  it("should execute command against the corresponding handler", () => {
    const bus = new CommandBus();

    const addTask = jest.fn();
    const removeTask = jest.fn();

    bus.register(new AddTaskCommandHandler(addTask));
    bus.register(new RemoveTaskCommandHandler(removeTask));

    bus.execute<AddTaskCommandHandler>(new AddTaskCommand("Buy milk"));

    expect(addTask).toBeCalledTimes(1);
  });

  it("should not allow to register 2 handlers for the same command", () => {
    const bus = new CommandBus();

    bus.register(new AddTaskCommandHandler(jest.fn()));

    expect(() => {
      bus.register(new AddTaskCommandHandler(jest.fn()));
    }).toThrowError();
  });

  it("should infer the return type of the handler", () => {
    const bus = new CommandBus();

    bus.register(new AddTaskCommandHandler(jest.fn()));

    // @ts-expect-error
    const result: number = bus.execute<AddTaskCommandHandler>(
      new AddTaskCommand("Buy milk")
    );

    expect.assertions(0);
  });

  it("should execute the middlewares", () => {
    const bus = new CommandBus();

    const middleware1 = jest.fn();
    const middleware2 = jest.fn();

    bus.register(new AddTaskCommandHandler(jest.fn()));

    bus.use((command, handler, next) => {
      middleware1();
      return next();
    });

    bus.use((command, handler, next) => {
      middleware2();
      return next();
    });

    bus.execute<AddTaskCommandHandler>(new AddTaskCommand("Buy milk"));

    expect(middleware1).toBeCalledTimes(1);
    expect(middleware2).toBeCalledTimes(1);
  });
});
