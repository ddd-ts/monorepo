import { QueryBus } from "./query-bus";

describe("QueryBus", () => {
  class GetTaskQuery {
    type = "GetTask";
    constructor(public readonly title: string) {}
  }

  class GetTaskQueryHandler {
    on = ["GetTask"] as const;
    constructor(private readonly mock: jest.Mock) {}
    execute(query: GetTaskQuery) {
      this.mock();
      return query.title;
    }
  }

  class ListTaskQuery {
    type = "ListTask";
    constructor(public readonly title: string) {}
  }

  class ListTaskQueryHandler {
    on = ["ListTask"] as const;
    constructor(private readonly mock: jest.Mock) {}
    execute(query: ListTaskQuery) {
      this.mock();
    }
  }

  it("should execute query against the corresponding handler", () => {
    const bus = new QueryBus();

    const getTask = jest.fn();
    const listTask = jest.fn();

    bus.register(new GetTaskQueryHandler(getTask));
    bus.register(new ListTaskQueryHandler(listTask));

    bus.execute<GetTaskQueryHandler>(new GetTaskQuery("Buy milk"));

    expect(getTask).toBeCalledTimes(1);
  });

  it("should not allow to register 2 handlers for the same query", () => {
    const bus = new QueryBus();

    bus.register(new GetTaskQueryHandler(jest.fn()));

    expect(() => {
      bus.register(new GetTaskQueryHandler(jest.fn()));
    }).toThrowError();
  });

  it("should infer the return type of the handler", () => {
    const bus = new QueryBus();

    bus.register(new GetTaskQueryHandler(jest.fn()));

    // @ts-expect-error
    const result: number = bus.execute<GetTaskQueryHandler>(
      new GetTaskQuery("Buy milk")
    );

    expect.assertions(0);
  });

  it("should execute the middlewares", () => {
    const bus = new QueryBus();

    const middleware1 = jest.fn();
    const middleware2 = jest.fn();

    bus.register(new GetTaskQueryHandler(jest.fn()));

    bus.use((query, handler, next) => {
      middleware1();
      return next();
    });

    bus.use((query, handler, next) => {
      middleware2();
      return next();
    });

    bus.execute<GetTaskQueryHandler>(new GetTaskQuery("Buy milk"));

    expect(middleware1).toBeCalledTimes(1);
    expect(middleware2).toBeCalledTimes(1);
  });
});
