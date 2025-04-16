import { EventId, type IEsEvent } from "@ddd-ts/core";
import { Constructor } from "@ddd-ts/types";
import { Account, AccountOpened } from "./account";
import { Deposited } from "./deposited.event";

function expectedChange(event: Constructor<IEsEvent>, payload: any) {
  return expect.objectContaining({
    name: event.name,
    id: expect.any(EventId),
    payload: expect.objectContaining({ ...payload }) ?? expect.anything(),
  });
}

describe("EsAggregate", () => {
  describe("when creating an aggregate", () => {
    it("should instanciate an aggregate", () => {
      const account = Account.open();

      expect(account.changes).toEqual([
        expectedChange(AccountOpened, { accountId: account.id }),
      ]);
    });

    it("acknowledged revision should initialize at -1, representing non existance", () => {
      const account = Account.open();

      expect(account.acknowledgedRevision).toEqual(-1);
    });
  });

  describe("when applying changes", () => {
    it("should store the changes", () => {
      const account = Account.open();

      account.deposit(100);

      expect(account.changes).toEqual([
        expectedChange(AccountOpened, { accountId: account.id }),
        expectedChange(Deposited, { accountId: account.id, amount: 100 }),
      ]);
    });

    it("should update the internal projection accordingly to the aggregate interactibility", () => {
      const account = Account.open();

      account.deposit(10);

      expect(account.balance).toEqual(10);
    });

    it("should not update the acknowledged revision", () => {
      const account = Account.open();

      account.deposit(10);

      expect(account.acknowledgedRevision).toEqual(-1);
    });
  });

  describe("when loading facts", () => {
    it("should load facts without adding them to changes", () => {
      const account = Account.open();
      account.acknowledgeChanges();

      expect(account.changes).toEqual([]);

      account.load(
        new Deposited({
          id: EventId.generate(),
          ref: "",
          revision: 1,
          name: "Deposited",
          occurredAt: new Date(),
          payload: {
            accountId: account.id,
            amount: 10,
          },
        }),
      );

      expect(account.changes).toEqual([]);
    });

    it("should not load changes", () => {
      const account = Account.open();
      account.acknowledgeChanges();

      expect(() =>
        account.load(Deposited.new({ accountId: account.id, amount: 10 })),
      ).toThrow("not a fact");
    });

    it("should update the internal projection accordingly to the loaded facts", () => {
      const account = Account.open();
      account.acknowledgeChanges();

      account.load(
        new Deposited({
          id: EventId.generate(),
          ref: "",
          name: "Deposited",
          occurredAt: new Date(),
          revision: 1,
          payload: {
            accountId: account.id,
            amount: 10,
          },
        }),
      );

      expect(account.balance).toEqual(10);
    });

    it("should update the acknowledged revision accordingly to the loaded facts", () => {
      const account = Account.open();
      account.acknowledgeChanges();

      expect(account.acknowledgedRevision).toEqual(0);

      account.load(
        new Deposited({
          id: EventId.generate(),
          ref: "",
          name: "Deposited",
          occurredAt: new Date(),
          revision: 1,
          payload: {
            accountId: account.id,
            amount: 10,
          },
        }),
      );

      expect(account.acknowledgedRevision).toEqual(1);
    });

    it("should not load a fact that happened later in the aggregate lifetime", () => {
      const account = Account.open();
      account.acknowledgeChanges();

      // expected revision 1
      expect(() =>
        account.load(
          new Deposited({
            id: EventId.generate(),
            ref: "",
            name: "Deposited",
            occurredAt: new Date(),
            revision: 2,
            payload: {
              accountId: account.id,
              amount: 10,
            },
          }),
        ),
      ).toThrow("not in sequence");
    });

    it("should not load a fact supposed to have happened earlier in the aggregate lifetime", () => {
      const account = Account.open();
      account.acknowledgeChanges();

      account.load(
        new Deposited({
          id: EventId.generate(),
          ref: "",
          name: "Deposited",
          occurredAt: new Date(),
          revision: 1,
          payload: {
            accountId: account.id,
            amount: 10,
          },
        }),
      );

      // expected revision 1
      expect(() =>
        account.load(
          new Deposited({
            id: EventId.generate(),
            ref: "",
            name: "Deposited",
            occurredAt: new Date(),
            revision: 1,
            payload: {
              accountId: account.id,
              amount: 10,
            },
          }),
        ),
      ).toThrow("already acknowledged");
    });

    it("should not load a fact after applying changes", () => {
      const account = Account.open();
      account.acknowledgeChanges();

      account.deposit(10);

      expect(() =>
        account.load(
          new Deposited({
            id: EventId.generate(),
            ref: "",
            name: "Deposited",
            occurredAt: new Date(),
            revision: 2,
            payload: {
              accountId: account.id,
              amount: 10,
            },
          }),
        ),
      ).toThrow("");
    });
  });
});
