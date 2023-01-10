import { Account } from "./account";
import { Deposited } from "./deposited.event";

describe("EsAggregate", () => {
  describe("when creating an aggregate", () => {
    it("should instanciate an aggregate with no changes", () => {
      const account = Account.new();

      expect(account.changes).toEqual([]);
    });

    it("acknowledged revision should initialize at -1, representing non existance", () => {
      const account = Account.new();

      expect(account.acknowledgedRevision).toEqual(-1n);
    });
  });

  describe("when applying changes", () => {
    it("should store the changes", () => {
      const account = Account.new();

      account.deposit(100);

      expect(account.changes).toEqual([Deposited.expectedChange(100)]);
    });

    it("should update the internal projection accordingly to the aggregate interactibility", () => {
      const account = Account.new();

      account.deposit(10);

      expect(account.balance).toEqual(10);
    });

    it("should not update the acknowledged revision", () => {
      const account = Account.new();

      account.deposit(10);

      expect(account.acknowledgedRevision).toEqual(-1n);
    });
  });

  describe("when loading changes", () => {
    it("should load facts without adding them to changes", () => {
      const account = Account.new();

      account.load(Deposited.newFact(10, 0n));

      expect(account.changes).toEqual([]);
    });

    it("should not load changes", () => {
      const account = Account.new();

      // @ts-ignore
      expect(() => account.load(Deposited.newChange(10))).toThrow();
    });

    it("should update the internal projection accordingly to the loaded facts", () => {
      const account = Account.new();

      account.load(Deposited.newFact(10, 0n));

      expect(account.balance).toEqual(10);
    });

    it("should update the acknowledged revision accordingly to the loaded facts", () => {
      const account = Account.new();

      account.load(Deposited.newFact(10, 0n));

      expect(account.acknowledgedRevision).toEqual(0n);
    });

    it("should not load a fact that happened later in the aggregate lifetime", () => {
      const account = Account.new();

      // expected the 0n
      expect(() => account.load(Deposited.newFact(10, 10n))).toThrow();
    });

    it("should not load a fact supposed to have happened earlier in the aggregate lifetime", () => {
      const account = Account.new();

      account.load(Deposited.newFact(10, 0n));

      // expected the 1n
      expect(() => account.load(Deposited.newFact(10, 0n))).toThrow();
    });

    it("should not load a fact after applying changes", () => {
      const account = Account.new();

      account.deposit(10);

      // expected the 1n
      expect(() => account.load(Deposited.newFact(10, 0n))).toThrow();
    });
  });
});
