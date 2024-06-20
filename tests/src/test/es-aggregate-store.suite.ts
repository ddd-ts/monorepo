import {
  AutoSerializer,
  SerializerRegistry,
  type EventSourced,
  type Identifiable,
  type IEsAggregateStore,
  type ISerializer,
} from "@ddd-ts/core";
import type { HasTrait } from "@ddd-ts/traits";

import { Account, AccountOpened } from "../app/domain/write/account/account";
import {
  Deposited,
  Withdrawn,
} from "../app/domain/write/account/deposited.event";
import {
  AccountSerializer,
  DepositedSerializer,
  WithdrawnSerializer,
} from "../app/infrastructure/account.serializer";

// function expectedFact(
//   event: Constructor<Event>,
//   revision: bigint,
//   payload: any,
// ) {
//   return expect.objectContaining({
//     type: event.name,
//     id: expect.any(String),
//     payload: expect.objectContaining({ ...payload }) ?? expect.anything(),
//     revision,
//   });
// }

// type DepositedMatcher = [Constructor<Deposited>, bigint, number];
// type TransferInitiatedMatcher = [
//   Constructor<TransferInitiated>,
//   bigint,
//   number,
// ];

// function expectFacts(
//   facts: IFact[],
//   expected: (DepositedMatcher | TransferInitiatedMatcher)[],
// ) {
//   const received = (facts as any).map(
//     (f: IFact<Deposited> | IFact<TransferInitiated>) => {
//       if (f.name === Deposited.name) {
//         return `${f.name} ${f.revision} ${f.payload.amount}`;
//       }
//       if (f.name === TransferInitiated.name) {
//         return `${f.name} ${f.revision} ${f.payload.amount}`;
//       }
//       throw new Error(`Unexpected name ${f.name}`);
//     },
//   );

//   const compared = expected.map(
//     ([type, revision, payload]) => `${type.name} ${revision} ${payload}`,
//   );

//   expect(received).toEqual(compared);
// }

jest.setTimeout(10000);

// biome-ignore lint/suspicious/noExportsInTest: <explanation>
export function EsAggregateStoreSuite(
  createStore: <
    T extends HasTrait<typeof EventSourced> & HasTrait<typeof Identifiable>,
  >(
    AGGREGATE: T,
    eventSerializer: ISerializer<InstanceType<T>["changes"][number]>,
    serializer: ISerializer<InstanceType<T>>,
  ) => IEsAggregateStore<InstanceType<T>>,
) {
  const eventSerializer = new SerializerRegistry()
    .add(AccountOpened, new (AutoSerializer(AccountOpened, 1))())
    .add(Deposited, new DepositedSerializer())
    .add(Withdrawn, new WithdrawnSerializer());

  const serializer = new AccountSerializer();

  const accountStore = createStore(Account, eventSerializer, serializer);

  // afterAll(() => {
  //   // return es.close();
  // });

  // beforeEach(async () => {
  //   await es.clear();
  // });

  describe("when persisting an aggregate", () => {
    it("should persist the aggregate", async () => {
      const account = Account.open();

      account.deposit(100);
      account.deposit(10);
      account.deposit(20);
      await accountStore.save(account);

      account.deposit(10);
      await accountStore.save(account);

      const loaded = await accountStore.load(account.id);

      expect(loaded?.id).toEqual(account.id);
      expect(loaded?.balance).toEqual(account.balance);
      expect(loaded?.acknowledgedRevision).toEqual(4);
    });

    it("should replay changes on the updated aggregate in case of concurrent writes", async () => {
      const account = Account.open();
      await accountStore.save(account);

      const copies = (
        await Promise.all(
          [...Array(7)].map(() => accountStore.load(account.id)),
        )
      ).map((copy) => {
        if (!copy) {
          throw new Error("Aggregate not loaded");
        }
        expect(copy.acknowledgedRevision).toEqual(0);
        copy.deposit(1);
        return copy;
      });

      const result = await Promise.allSettled(
        copies.map((copy) => accountStore.save(copy)),
      );

      const errors = result.filter((r) => r.status === "rejected");
      expect(errors.map((i) => i.reason)).toEqual([]);

      expect(result.filter((r) => r.status === "rejected").length).toBe(0);

      const loaded = await accountStore.load(account.id);

      expect(loaded?.balance).toEqual(7);
    }, 40_000);
  });

  // describe("when reading a projected stream", () => {
  //   it("should read the projected stream", async () => {
  //     const accountA = Account.open();
  //     accountA.deposit(100);

  //     const accountB = Account.open();
  //     accountB.deposit(200);

  //     await accountStore.save(accountA);
  //     await accountStore.save(accountB);

  //     const reader = new EsProjectedStreamReader<[typeof Account]>(es, [
  //       [new DepositedSerializer(), new WithdrawnSerializer()],
  //     ]);

  //     await new Promise((resolve) => setTimeout(resolve, 100));

  //     const events = await buffer(reader.read([Account]), 2);

  //     expect(events).toEqual([
  //       expectedFact(Deposited, 0n, { amount: 100 }),
  //       expectedFact(Deposited, 1n, { amount: 200 }),
  //     ]);
  //   });

  //   // unstable with firestore
  //   it("should read the projected stream from the specified revision", async () => {
  //     const account = Account.open();
  //     account.deposit(100);
  //     account.deposit(200);

  //     await accountStore.save(account);

  //     const reader = new EsProjectedStreamReader<[typeof Account]>(es, [
  //       [new DepositedSerializer(), new WithdrawnSerializer()],
  //     ]);

  //     await new Promise((resolve) => setTimeout(resolve, 100));

  //     const events: any[] = await buffer(reader.read([Account], 1n));

  //     expectFacts(events, [[Deposited, 1n, 200]]);
  //   });

  //   it("should read a projected stream of multiple aggregates", async () => {
  //     const accountA = Account.open();
  //     accountA.deposit(100);
  //     await accountStore.save(accountA);

  //     const accountB = Account.open();
  //     accountB.deposit(100);
  //     await accountStore.save(accountB);

  //     const transferA = Transfer.initiate(accountA.id, accountB.id, 10);
  //     await transferStore.persist(transferA);

  //     const reader = new EsProjectedStreamReader<
  //       [typeof Account, typeof Transfer]
  //     >(es, [
  //       [new DepositedSerializer(), new WithdrawnSerializer()],
  //       [
  //         new TransferInitiatedSerializer(),
  //         new TransferAmountClaimedSerializer(),
  //       ],
  //     ]);

  //     await new Promise((resolve) => setTimeout(resolve, 100));

  //     const events = await buffer(reader.read([Account, Transfer]), 3);

  //     expect(events).toEqual([
  //       expectedFact(Deposited, 0n, { amount: 100 }),
  //       expectedFact(Deposited, 1n, { amount: 100 }),
  //       expectedFact(TransferInitiated, 2n, {
  //         from: accountA.id,
  //         to: accountB.id,
  //         amount: 10,
  //       }),
  //     ]);
  //   }, 10000);
  // });

  // describe("when following a projected stream", () => {
  //   it("should follow the projected stream", async () => {
  //     const account = Account.open();

  //     account.deposit(100);
  //     await accountStore.save(account);

  //     const reader = new EsProjectedStreamReader<[typeof Account]>(es, [
  //       [new DepositedSerializer(), new WithdrawnSerializer()],
  //     ]);

  //     const follower = await reader.follow([Account]);

  //     const [existing] = await buffer(follower, 1);

  //     expect(existing).toEqual(expectedFact(Deposited, 0n, { amount: 100 }));

  //     account.deposit(200);
  //     await accountStore.save(account);

  //     const [live] = await buffer(follower, 1);

  //     expect(live).toEqual(expectedFact(Deposited, 1n, { amount: 200 }));
  //   });

  //   it("should follow a projected stream of multiple aggregate streams", async () => {
  //     const accountA = Account.open();
  //     accountA.deposit(100);
  //     await accountStore.save(accountA);

  //     const accountB = Account.open();
  //     accountB.deposit(100);
  //     await accountStore.save(accountB);

  //     const transferA = Transfer.new(accountA.id, accountB.id, 10);
  //     await transferStore.persist(transferA);

  //     const reader = new EsProjectedStreamReader<
  //       [typeof Account, typeof Transfer]
  //     >(es, [
  //       [new DepositedSerializer(), new WithdrawnSerializer()],
  //       [
  //         new TransferInitiatedSerializer(),
  //         new TransferAmountClaimedSerializer(),
  //       ],
  //     ]);
  //     const follower = await reader.follow([Account, Transfer]);

  //     const existing = await buffer(follower, 3);

  //     expect(existing).toEqual([
  //       expectedFact(Deposited, 0n, { amount: 100 }),
  //       expectedFact(Deposited, 1n, { amount: 100 }),
  //       expectedFact(TransferInitiated, 2n, {
  //         from: accountA.id,
  //         to: accountB.id,
  //         amount: 10,
  //       }),
  //     ]);

  //     const transferB = Transfer.new(accountA.id, accountB.id, 20);
  //     await transferStore.persist(transferB);

  //     const live = await buffer(follower, 1);

  //     expect(live).toEqual([
  //       expectedFact(TransferInitiated, 3n, {
  //         from: accountA.id,
  //         to: accountB.id,
  //         amount: 20,
  //       }),
  //     ]);
  //   });

  //   it("should aggregate new corresponding streams on the fly", async () => {
  //     const reader = new EsProjectedStreamReader<
  //       [typeof Account, typeof Transfer]
  //     >(es, [
  //       [new DepositedSerializer(), new WithdrawnSerializer()],
  //       [
  //         new TransferInitiatedSerializer(),
  //         new TransferAmountClaimedSerializer(),
  //       ],
  //     ]);

  //     const follower = await reader.follow([Account, Transfer]);

  //     const account = Account.open();
  //     account.deposit(100);
  //     await accountStore.save(account);

  //     const [fact] = await buffer(follower, 1);
  //     expect(fact).toEqual(expectedFact(Deposited, 0n, { amount: 100 }));

  //     const transfer = Transfer.new(account.id, account.id, 10);
  //     await transferStore.persist(transfer);

  //     const [fact2] = await buffer(follower, 1);
  //     expect(fact2).toEqual(
  //       expectedFact(TransferInitiated, 1n, {
  //         from: account.id,
  //         to: account.id,
  //         amount: 10,
  //       }),
  //     );
  //   });

  //   // TODO: it should not aggregate not corresponding streams on the fly

  //   describe("should follow the projected stream from the specified revision", () => {
  //     it("when starting from an existing revision", async () => {
  //       const reader = new EsProjectedStreamReader<
  //         [typeof Account, typeof Transfer]
  //       >(es, [
  //         [new DepositedSerializer(), new WithdrawnSerializer()],
  //         [
  //           new TransferInitiatedSerializer(),
  //           new TransferAmountClaimedSerializer(),
  //         ],
  //       ]);

  //       const account = Account.open();

  //       account.deposit(100);
  //       account.deposit(200);
  //       await accountStore.save(account);

  //       const follower = await reader.follow([Account, Transfer], 1n);

  //       const [existing] = await buffer(follower, 1);
  //       expect(existing).toEqual(expectedFact(Deposited, 1n, { amount: 200 }));

  //       account.deposit(300);
  //       await accountStore.save(account);

  //       const [live] = await buffer(follower, 1);
  //       expect(live).toEqual(expectedFact(Deposited, 2n, { amount: 300 }));

  //       const transfer = Transfer.new(account.id, account.id, 10);
  //       await transferStore.persist(transfer);

  //       const [live2] = await buffer(follower, 1);
  //       expect(live2).toEqual(
  //         expectedFact(TransferInitiated, 3n, {
  //           from: account.id,
  //           to: account.id,
  //           amount: 10,
  //         }),
  //       );
  //     }, 10000);

  //     it("when starting from a non-existing revision", async () => {
  //       const reader = new EsProjectedStreamReader<[typeof Account]>(es, [
  //         [new DepositedSerializer(), new WithdrawnSerializer()],
  //       ]);

  //       const account = Account.open();

  //       account.deposit(100);
  //       await accountStore.save(account);

  //       const follower = await reader.follow([Account], 3n);
  //       account.deposit(100);
  //       account.deposit(100);

  //       account.deposit(200);
  //       account.deposit(300);
  //       await accountStore.save(account);

  //       const [live] = await buffer(follower, 1);
  //       expect(live).toEqual(expectedFact(Deposited, 3n, { amount: 200 }));
  //     });
  //   });

  //   // Warning: this test test the implementation detail of the projected stream
  //   // it("should cleanup the corresponding streams when the follower closes", async () => {
  //   //   const account = Account.open();
  //   //   account.deposit(100);
  //   //   await persistor.persist(account);

  //   //   const follower = await reader.follow(Account);

  //   //   follower.close();

  //   //   const streamName = "Account-" + account.id.serialize();
  //   //   const correspondingStream = persistor.store.get(streamName);
  //   //   expect(correspondingStream?.subscribers.size).toEqual(0);
  //   // });
  //   // it("should stop following a projected stream", async () => {
  //   //   const account = Account.open();

  //   //   const follower = await reader.follow(Account);

  //   //   account.deposit(100);
  //   //   await persistor.persist(account);

  //   //   const [existing] = await buffer(follower, 1);
  //   //   expect(existing).toEqual(Deposited.expectedFact(100, 0n));

  //   //   await follower.stop();

  //   //   account.deposit(200);
  //   //   await persistor.persist(account);

  //   //   const [live] = await buffer(follower, 1);
  //   //   expect(live).toEqual(undefined);
  //   // });
  // });

  // describe.skip("when competing for a projected stream", () => {
  //   const expectedAttempt = (fact: Fact<Deposited>) =>
  //     expect.objectContaining({ fact });

  //   it("should load balance facts between competitors of the same competition", async () => {
  //     const reader = new EsProjectedStreamReader<[typeof Account]>(es, [
  //       [new DepositedSerializer(), new WithdrawnSerializer()],
  //     ]);

  //     const competitorA = await reader.compete(
  //       [Account],
  //       "default-competition",
  //     );
  //     const competitorB = await reader.compete(
  //       [Account],
  //       "default-competition",
  //     );

  //     const account = Account.open();
  //     account.deposit(100);
  //     account.deposit(200);
  //     account.deposit(300);
  //     await accountStore.save(account);

  //     const [factsOfA, factsOfB] = await Promise.all([
  //       buffer(competitorA, 2),
  //       buffer(competitorB, 1),
  //     ]);

  //     expect(factsOfA).toEqual([
  //       expectedAttempt(expectedFact(Deposited, 0n, { amount: 100 })),
  //       expectedAttempt(expectedFact(Deposited, 2n, { amount: 300 })),
  //     ]);

  //     expect(factsOfB).toEqual([
  //       expectedAttempt(expectedFact(Deposited, 1n, { amount: 200 })),
  //     ]);
  //   });

  //   it("should propagate all facts to every competition", async () => {
  //     const reader = new EsProjectedStreamReader<[typeof Account]>(es, [
  //       [new DepositedSerializer(), new WithdrawnSerializer()],
  //     ]);

  //     const competitorA = await reader.compete([Account], "competition-a");
  //     const competitorB = await reader.compete([Account], "competition-b");

  //     const account = Account.open();
  //     account.deposit(100);
  //     account.deposit(200);
  //     account.deposit(300);
  //     await accountStore.save(account);

  //     const [attemptsOfA, attemptsOfB] = await Promise.all([
  //       buffer(competitorA, 3),
  //       buffer(competitorB, 3),
  //     ]);

  //     expect(attemptsOfA).toEqual([
  //       expectedAttempt(expectedFact(Deposited, 0n, { amount: 100 })),
  //       expectedAttempt(expectedFact(Deposited, 1n, { amount: 200 })),
  //       expectedAttempt(expectedFact(Deposited, 2n, { amount: 300 })),
  //     ]);
  //     expect(attemptsOfB).toEqual([
  //       expectedAttempt(expectedFact(Deposited, 0n, { amount: 100 })),
  //       expectedAttempt(expectedFact(Deposited, 1n, { amount: 200 })),
  //       expectedAttempt(expectedFact(Deposited, 2n, { amount: 300 })),
  //     ]);
  //   });

  //   it("should use the remaining competitors if one of them is closed", async () => {
  //     const reader = new EsProjectedStreamReader<[typeof Account]>(es, [
  //       [new DepositedSerializer(), new WithdrawnSerializer()],
  //     ]);

  //     const competitorA = await reader.compete(
  //       [Account],
  //       "default-competition",
  //     );
  //     const competitorB = await reader.compete(
  //       [Account],
  //       "default-competition",
  //     );

  //     const account = Account.open();
  //     account.deposit(100);
  //     account.deposit(200);
  //     account.deposit(300);
  //     await accountStore.save(account);

  //     await competitorB.close();

  //     const [attemptsOfA, attemptsOfB] = await Promise.all([
  //       buffer(competitorA, 3),
  //       buffer(competitorB, 0),
  //     ]);

  //     expect(attemptsOfA).toEqual([
  //       expectedAttempt(expectedFact(Deposited, 0n, { amount: 100 })),
  //       expectedAttempt(expectedFact(Deposited, 1n, { amount: 200 })),
  //       expectedAttempt(expectedFact(Deposited, 2n, { amount: 300 })),
  //     ]);
  //     expect(attemptsOfB).toEqual([]);
  //   });

  //   it("should allow to retry an attempt", async () => {
  //     const reader = new EsProjectedStreamReader<[typeof Account]>(es, [
  //       [new DepositedSerializer(), new WithdrawnSerializer()],
  //     ]);

  //     const competitorA = await reader.compete(
  //       [Account],
  //       "default-competition",
  //     );
  //     const competitorB = await reader.compete(
  //       [Account],
  //       "default-competition",
  //     );

  //     const account = Account.open();
  //     account.deposit(100);
  //     await accountStore.save(account);

  //     const [attempt1] = await buffer(competitorA, 1);
  //     expect(attempt1).toEqual(
  //       expectedAttempt(expectedFact(Deposited, 0n, { amount: 100 })),
  //     );

  //     await attempt1.retry();

  //     const [attempt2] = await buffer(competitorB, 1);
  //     expect(attempt2).toEqual(
  //       expectedAttempt(expectedFact(Deposited, 0n, { amount: 100 })),
  //     );
  //   });
  // });
}
