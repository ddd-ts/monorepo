import { Fact } from "../event/event";
import { Account } from "../test/app/domain/account/account";
import { Deposited } from "../test/app/domain/account/deposited.event";
import { EsAggregatePersistor } from "./es-aggregate.persistor";
import { EsProjectedStreamReader } from "./es-projected-stream.reader";
import { EventStore } from "./event-store/event-store";
import { FirestoreEventStore } from "./event-store/firestore/firestore.event-store";
import { buffer } from "./tools/iterator";

const eventStores = [
  // new ESDBEventStore(),
  // new InMemoryEventStore(),
  new FirestoreEventStore(),
];

describe.each(eventStores)(
  "EsAggregateStore",
  (es: EventStore & { clear(): void }) => {
    const persistor = new (EsAggregatePersistor(Account))(es);
    const reader = new EsProjectedStreamReader(es);

    afterAll(() => {
      (es as any).close();
    });

    beforeEach(() => {
      es.clear();
    });

    describe("when persisting an aggregate", () => {
      it("should persist the aggregate", async () => {
        const account = Account.new();

        account.deposit(100);
        account.deposit(10);
        account.deposit(20);
        await persistor.persist(account);

        account.deposit(10);
        await persistor.persist(account);

        const loaded = await persistor.load(account.id);

        expect(loaded!.id).toEqual(account.id);
        expect(loaded!.balance).toEqual(account.balance);
        expect(loaded!.acknowledgedRevision).toEqual(3n);
      });

      it("should throw if the aggregate stream is not at the expected revision", async () => {
        const account = Account.new();
        account.deposit(100);

        await persistor.persist(account);

        const loadedA = await persistor.load(account.id);
        const loadedB = await persistor.load(account.id);

        loadedA!.deposit(100);
        await persistor.persist(loadedA!);
        await expect(persistor.persist(loadedB!)).rejects.toThrow();
      });
    });

    describe("when reading a projected stream", () => {
      it("should read the projected stream", async () => {
        const accountA = Account.new();
        accountA.deposit(100);

        const accountB = Account.new();
        accountB.deposit(200);

        await persistor.persist(accountA);
        await persistor.persist(accountB);

        await new Promise((resolve) => setTimeout(resolve, 100));

        const events = await buffer(reader.read(Account), 2);

        expect(events).toEqual([
          Deposited.expectedFact(100, 0n),
          Deposited.expectedFact(200, 1n),
        ]);
      });

      it("should read the projected stream from the specified revision", async () => {
        const account = Account.new();
        account.deposit(100);
        account.deposit(200);

        await persistor.persist(account);

        await new Promise((resolve) => setTimeout(resolve, 100));

        const events = await buffer(reader.read(Account, 1n));

        expect(events).toEqual([Deposited.expectedFact(200, 1n)]);
      });
    });

    describe("when following a projected stream", () => {
      it("should follow the projected stream", async () => {
        const account = Account.new();

        account.deposit(100);
        await persistor.persist(account);

        const follower = await reader.follow(Account);

        const [existing] = await buffer(follower, 1);
        expect(existing).toEqual(Deposited.expectedFact(100, 0n));

        account.deposit(200);
        await persistor.persist(account);

        const [live] = await buffer(follower, 1);

        expect(live).toEqual(Deposited.expectedFact(200, 1n));
      });

      it("should aggregate new corresponding streams on the fly", async () => {
        const follower = await reader.follow(Account);

        const account = Account.new();
        account.deposit(100);
        await persistor.persist(account);

        const [fact] = await buffer(follower, 1);
        expect(fact).toEqual(Deposited.expectedFact(100, 0n));
      });

      // TODO: it should not aggregate not corresponding streams on the fly

      describe("should follow the projected stream from the specified revision", () => {
        it("when starting from an existing revision", async () => {
          const account = Account.new();

          account.deposit(100);
          account.deposit(200);
          await persistor.persist(account);

          const follower = await reader.follow(Account, 1n);

          const [existing] = await buffer(follower, 1);
          expect(existing).toEqual(Deposited.expectedFact(200, 1n));

          account.deposit(300);
          await persistor.persist(account);

          const [live] = await buffer(follower, 1);
          expect(live).toEqual(Deposited.expectedFact(300, 2n));
        }, 10000);

        it("when starting from a non-existing revision", async () => {
          const account = Account.new();

          account.deposit(100);
          await persistor.persist(account);

          const follower = await reader.follow(Account, 1n);

          account.deposit(200);
          account.deposit(300);
          await persistor.persist(account);

          const [live] = await buffer(follower, 1);
          expect(live).toEqual(Deposited.expectedFact(200, 1n));
        });
      });

      // Warning: this test test the implementation detail of the projected stream
      // it("should cleanup the corresponding streams when the follower closes", async () => {
      //   const account = Account.new();
      //   account.deposit(100);
      //   await persistor.persist(account);

      //   const follower = await reader.follow(Account);

      //   follower.close();

      //   const streamName = "Account-" + account.id.serialize();
      //   const correspondingStream = persistor.store.get(streamName);
      //   expect(correspondingStream?.subscribers.size).toEqual(0);
      // });
      // it("should stop following a projected stream", async () => {
      //   const account = Account.new();

      //   const follower = await reader.follow(Account);

      //   account.deposit(100);
      //   await persistor.persist(account);

      //   const [existing] = await buffer(follower, 1);
      //   expect(existing).toEqual(Deposited.expectedFact(100, 0n));

      //   await follower.stop();

      //   account.deposit(200);
      //   await persistor.persist(account);

      //   const [live] = await buffer(follower, 1);
      //   expect(live).toEqual(undefined);
      // });
    });

    describe.skip("when competing for a projected stream", () => {
      const expectedAttempt = (fact: Fact<Deposited>) =>
        expect.objectContaining({ fact });

      it("should load balance facts between competitors of the same competition", async () => {
        const competitorA = await reader.compete(
          Account,
          "default-competition"
        );
        const competitorB = await reader.compete(
          Account,
          "default-competition"
        );

        const account = Account.new();
        account.deposit(100);
        account.deposit(200);
        account.deposit(300);
        await persistor.persist(account);

        const [factsOfA, factsOfB] = await Promise.all([
          buffer(competitorA, 2),
          buffer(competitorB, 1),
        ]);

        expect(factsOfA).toEqual([
          expectedAttempt(Deposited.expectedFact(100, 0n)),
          expectedAttempt(Deposited.expectedFact(300, 2n)),
        ]);

        expect(factsOfB).toEqual([
          expectedAttempt(Deposited.expectedFact(200, 1n)),
        ]);
      });

      it("should propagate all facts to every competition", async () => {
        const competitorA = await reader.compete(Account, "competition-a");
        const competitorB = await reader.compete(Account, "competition-b");

        const account = Account.new();
        account.deposit(100);
        account.deposit(200);
        account.deposit(300);
        await persistor.persist(account);

        const [attemptsOfA, attemptsOfB] = await Promise.all([
          buffer(competitorA, 3),
          buffer(competitorB, 3),
        ]);

        expect(attemptsOfA).toEqual([
          expectedAttempt(Deposited.expectedFact(100, 0n)),
          expectedAttempt(Deposited.expectedFact(200, 1n)),
          expectedAttempt(Deposited.expectedFact(300, 2n)),
        ]);
        expect(attemptsOfB).toEqual([
          expectedAttempt(Deposited.expectedFact(100, 0n)),
          expectedAttempt(Deposited.expectedFact(200, 1n)),
          expectedAttempt(Deposited.expectedFact(300, 2n)),
        ]);
      });

      it("should use the remaining competitors if one of them is closed", async () => {
        const competitorA = await reader.compete(
          Account,
          "default-competition"
        );
        const competitorB = await reader.compete(
          Account,
          "default-competition"
        );

        const account = Account.new();
        account.deposit(100);
        account.deposit(200);
        account.deposit(300);
        await persistor.persist(account);

        await competitorB.close();

        const [attemptsOfA, attemptsOfB] = await Promise.all([
          buffer(competitorA, 3),
          buffer(competitorB, 0),
        ]);

        expect(attemptsOfA).toEqual([
          expectedAttempt(Deposited.expectedFact(100, 0n)),
          expectedAttempt(Deposited.expectedFact(200, 1n)),
          expectedAttempt(Deposited.expectedFact(300, 2n)),
        ]);
        expect(attemptsOfB).toEqual([]);
      });

      it("should allow to retry an attempt", async () => {
        const competitorA = await reader.compete(
          Account,
          "default-competition"
        );
        const competitorB = await reader.compete(
          Account,
          "default-competition"
        );

        const account = Account.new();
        account.deposit(100);
        await persistor.persist(account);

        const [attempt1] = await buffer(competitorA, 1);
        expect(attempt1).toEqual(
          expectedAttempt(Deposited.expectedFact(100, 0n))
        );

        await attempt1.retry();

        const [attempt2] = await buffer(competitorB, 1);
        expect(attempt2).toEqual(
          expectedAttempt(Deposited.expectedFact(100, 0n))
        );
      });
    });
  }
);
