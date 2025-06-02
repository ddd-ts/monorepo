// // import { wait } from "./tools";

// import {
//   FirestoreTransaction,
//   FirestoreTransactionPerformer,
// } from "@ddd-ts/store-firestore";
// import { Derive, Subtrait, Trait, UnionToIntersection } from "@ddd-ts/traits";

// // describe("pipe", () => {
// //   it("works", async () => {
// //     const task = async (value: string) => {
// //       await wait(10);
// //       console.log(`Task done: ${value}`);
// //     };

// //     async function* delay(stream: AsyncIterableIterator<string>) {
// //       for await (const item of stream) {
// //         yield wait(100).then(() => task(item));
// //       }
// //     }

// //     async function* sequential(
// //       stream: AsyncIterable<string>,
// //     ): AsyncIterable<string> {
// //       for await (const item of stream) {
// //         const operation = yield item;
// //         if (operation) {
// //           await operation;
// //         }
// //       }
// //     }

// //     async function buffer(stream: AsyncIterable<string>) {
// //       const buffer: string[] = [];
// //       for await (const item of stream) {
// //         buffer.push(item);
// //       }
// //       return buffer;
// //     }

// //     async function* events(n: number) {
// //       let i = n;
// //       while (i--) {
// //         await wait(100);
// //         yield i;
// //       }
// //     }

// //     // sequential([''])

// //     async function* batch(first: string) {
// //       const promise = new Promise((resolve) => {});
// //       while (true) {
// //         const next = yield promise;
// //       }
// //     }

// //     async function* check() {
// //       let i = 0;
// //       while (true) {
// //         const result = yield i++;
// //         console.log(result);
// //       }
// //     }

// //     const stream = everyOther();
// //     stream.next();

// //     const result1 = stream.next("Hello");
// //     console.log(result1.value);
// //     const result2 = stream.next("World");
// //     console.log(result2.value);

// //     await wait(1000);
// //   });
// // });
// abstract class Middleware<Params extends any[] = any[]> {
//   execute(
//     input: any[],
//     context: any,
//     next: (input: any[], context: any) => Promise<any>,
//   ): Promise<any> {
//     throw new Error("Method not implemented.");
//   }
// }

// class LogBeforeMiddleware<T extends any[]> extends Middleware<T> {
//   async execute<C extends {}, R>(
//     input: T,
//     context: C,
//     next: (input: T, context: C) => Promise<R>,
//   ) {
//     console.log("before:", input);
//     return next(input, context);
//   }
// }

// class LogAfterMiddleware<T extends any[]> extends Middleware<T> {
//   async execute<C extends {}, R>(
//     input: T,
//     context: C,
//     next: (input: T, context: C) => Promise<R>,
//   ) {
//     const result = await next(input, context);
//     console.log("after:", result);
//     return result;
//   }
// }

// class TimeMiddleware<T extends any[]> extends Middleware<T> {
//   async execute<C extends {}, R>(
//     input: T,
//     context: C,
//     next: (input: T, context: C) => Promise<R>,
//   ) {
//     const start = Date.now();
//     const result = await next(input, context);
//     const end = Date.now();
//     console.log(`Execution time: ${end - start}ms`);
//     return result;
//   }
// }

// class ContextAMiddleware<T extends any[]> extends Middleware<T> {
//   async execute<C extends {}, R>(
//     input: T,
//     context: C,
//     next: (input: T, context: C & { a: string }) => Promise<R>,
//   ) {
//     const start = Date.now();
//     const result = await next(input, { ...context, a: "Context A" });
//     const end = Date.now();
//     console.log(`Execution time: ${end - start}ms`);
//     return result;
//   }
// }

// // class Pipe<
// //   const M extends Array<
// //     | TimeMiddleware<any>
// //     | LogBeforeMiddleware<any>
// //     | LogAfterMiddleware<any>
// //     | ContextAMiddleware<any>
// //   >,
// // > {
// //   constructor(private middlewares: M) {}

// //   pipe(
// //     handler: <C extends {}>(
// //       ...args: [
// //         ...input: M extends [...any[], infer T extends { execute: (...args: any[]) => any }]
// //           ? Parameters<T['execute']>[0]
// //           : never,
// //         context: C &
// //           UnionToIntersection<
// //             Parameters<Parameters<M[number]["execute"]>[2]>[1]
// //           >,
// //       ]
// //     ) => Promise<any>,
// //   ) {
// //     let index = 0;

// //     const next = async (...input: any, context: any): Promise<any> => {
// //       if (index >= this.middlewares.length) {
// //         return handler(...input, context);
// //       }
// //       const middleware = this.middlewares[index++];
// //       return middleware.execute(...input as any, context, next);
// //     };

// //     return next;
// //   }
// // }

// type Output<Ms extends Middleware[]> = Ms extends []
//   ? any
//   : Ms extends [...any, infer M]
//     ? M extends Middleware<infer P>
//       ? P extends any[]
//         ? P
//         : never
//       : never
//     : never;

// class PIPE<Params extends any[], Ms extends Middleware[] = []> {
//   middlewares: Middleware[] = [];

//   with<M extends Ms extends [] ? Middleware<Params> : Middleware<Output<Ms>>>(
//     middleware: M,
//   ) {
//     this.middlewares.push(middleware);
//     return this as PIPE<Params, [...Ms, M]>;
//   }
// }

// type Fun<P extends any[], R> = (...args: P) => Promise<R>;

// function withLogBefore<F extends Fun<any[], any>>(
//   fn: F,
// ): Fun<Parameters<F>, ReturnType<F>> {
//   return (...args: Parameters<F>) => {
//     console.log("before:", args);
//     return fn(...args);
//   };
// }

// function withLogAfter<F extends Fun<any[], any>>(
//   fn: F,
// ): Fun<Parameters<F>, ReturnType<F>> {
//   return async (...args: Parameters<F>) => {
//     const result = await fn(...args);
//     console.log("after:", result);
//     return result;
//   };
// }

// function withTime<F extends Fun<any[], any>>(
//   fn: F,
// ): Fun<Parameters<F>, ReturnType<F>> {
//   return async (...args: Parameters<F>) => {
//     const start = Date.now();
//     const result = await fn(...args);
//     const end = Date.now();
//     console.log(`Execution time: ${end - start}ms`);
//     return result;
//   };
// }

// function withContextA<F extends Fun<[any, { a: string }], any>>(fn: F) {
//   return async <I, C extends {}>(input: I, context: C) => {
//     const newContext = { ...context, a: "Context A" };
//     const result = await fn(input, newContext);
//     return result;
//   };
// }

// // const handler = withLogBefore(
// //   withTime(
// //     withLogAfter(
// //       withContextA(async (a, b) => {
// //         console.log("Final handler:", a, b);
// //         return `Processed: ${a} ${b.a}`;
// //       }),
// //     ),
// //   ),
// // );

// const Handler = <T>() =>
//   Trait((base) => {
//     abstract class HandlerBase<T> extends base {
//       declare input: T[];
//       declare needs: {};
//       declare exposes: {};
//       // abstract handle<R>(input: T, context: this["exposes"]): Promise<R>;

//       abstract async execute(input: T[], context: this["needs"]) {
//         return Promise.all(input.map((item) => this.handle(item, context)));
//       }
//     }
//     return HandlerBase<T>;
//   });

//   const ParallelHandler = <T>() =>
//     Trait((base) => {
//       abstract class HandlerBase<T> extends base {
//         declare input: T[];
//         declare needs: {};
//         declare exposes: {};
//         abstract handle<R>(input: T, context: this["exposes"]): Promise<R>;

//         async execute(input: T[], context: this["needs"]) {
//           return Promise.all(input.map((item) => this.handle(item, context)));
//         }
//       }
//       return HandlerBase<T>;
//     });

// const BatchHandler = Trait((base) => {
//   abstract class BatchHandlerBase<T> extends base {
//     declare input: T[];
//     declare needs: {};
//     declare exposes: {};
//     abstract handle<R>(input: T[], context: this["exposes"]): Promise<R>;
//     async execute(input: T[], context: this["needs"]) {
//       return this.handleBatch(input, context);
//     }
//   }
// });

// const WithTime = Subtrait([{} as ReturnType<typeof Handler>], (base) => {
//   abstract class WithTime extends base {
//     declare exposes: { a: string };
//     declare needs: { b: string };

//     async execute(input: this["input"], context: this["needs"]) {
//       const start = Date.now();
//       const result = await super.execute(input, {
//         ...context,
//         a: "Context A",
//       });
//       const end = Date.now();
//       console.log(`Execution time: ${end - start}ms`);
//       return result as any;
//     }
//   }

//   return WithTime;
// });

// const WithFirestoreTransaction = Subtrait(
//   [{} as ReturnType<typeof Handler>],
//   (base, Props) => {
//     abstract class WithFirestoreTransaction extends base {
//       transactionPerformer: FirestoreTransactionPerformer;
//       constructor(
//         props: typeof Props & {
//           transactionPerformer: FirestoreTransactionPerformer;
//         },
//       ) {
//         super(props);
//         this.transactionPerformer = props.transactionPerformer;
//       }

//       declare exposes: { transaction: FirestoreTransaction };
//       async execute(input: this["input"], context: this["needs"]) {
//         return this.transactionPerformer.perform(async (trx) => {
//           const newContext = { ...context, transaction: trx };
//           return super.execute(input, newContext);
//         });
//       }
//     }
//     return WithFirestoreTransaction;
//   },
// );
// class MyHandler extends Derive(
//   Handler<string>(),
//   WithTime,
//   WithFirestoreTransaction,
// ) {
//   async handle(input: string, context: this["exposes"]) {
//     console.log("Final handler:", input, context);
//     return `Processed: ${input[0]} ${context.a} with transaction: ${context.transaction}` as any;
//   }
// }

// new MyHandler({}).execute(["uu"], {});

// // new PIPE<[string]>()
// //   .with(new LogBeforeMiddleware<[string]>())
// //   .with(new TimeMiddleware<[number]>())
// //   .with(new LogAfterMiddleware<[string]>())
// //   .with(new ContextAMiddleware<[string]>());

// // it("works", async () => {
// //   const handler = new Pipe([
// //     new LogBeforeMiddleware<[string]>(),
// //     new TimeMiddleware<[number]>(),
// //     new LogAfterMiddleware<[string]>(),
// //     new ContextAMiddleware<[string]>(),
// //   ]).pipe(async (input, context) => {
// //     console.log("Final handler:", input);
// //     return `Processed: ${input} ${context.a}`;
// //   });

// //   const test = await handler("Hello, World!", {});

// //   expect(test).toBe("Processed: Hello, World!");
// // });
