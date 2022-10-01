export interface Query {
  readonly type: string;
}

export interface QueryHandler<E extends Query = Query> {
  readonly on: readonly E["type"][];
  execute(query: E): any;
}

export interface QueryBusMiddleware<H extends QueryHandler = QueryHandler> {
  (query: Query, handler: H, next: () => ReturnType<H["execute"]>): any;
}
