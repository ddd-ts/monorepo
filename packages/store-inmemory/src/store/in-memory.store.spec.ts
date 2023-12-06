import { Serialized, Serializer } from "@ddd-ts/serialization";
import {
  InMemoryDatabase,
  InMemoryStore,
  InMemoryTransactionPerformer,
} from "..";
import {
  CannotReadAfterWrites,
  TransactionCollidedTooManyTimes,
} from "./in-memory.database";

class MyElement {
  constructor(public readonly id: string, public name: string) {}

  public setName(name: string) {
    this.name = name;
  }
}

class MyElementSerializer extends Serializer(MyElement)(1n) {
  serialize(value: MyElement) {
    return { version: this.version, id: value.id, name: value.name };
  }

  deserialize(value: Serialized<this>) {
    return new MyElement(value.id, value.name);
  }
}

describe("InMemoryStore", () => {
  function getStore() {
    const database = new InMemoryDatabase();
    const store = new InMemoryStore<MyElement>(
      "my_collection",
      database,
      new MyElementSerializer()
    );
    const transactionPerformer = new InMemoryTransactionPerformer(database);
    return { store, transactionPerformer };
  }

  it("saves", async () => {
    const { store } = getStore();

    const element = new MyElement("myid", "timothee");
    await store.save(element);
  });

  it("loads", async () => {
    const { store } = getStore();

    const element = new MyElement("myid", "timothee");
    await store.save(element);
    const pristine = await store.load(element.id);
    expect(pristine).toEqual(element);
  });

  it("deletes", async () => {
    const { store } = getStore();

    const element = new MyElement("myid", "timothee");
    await store.save(element);
    const pristine = await store.delete(element.id);
    expect(pristine).toEqual(undefined);
  });

  it("transactionally writes", async () => {
    const { store, transactionPerformer } = getStore();

    const element = new MyElement("myid", "timothee");
    await transactionPerformer.perform(async (transaction) => {
      await store.save(element, transaction);
    });
    const pristine = await store.load(element.id);
    expect(pristine).toEqual(element);
  });

  it("transactionally deletes", async () => {
    const { store, transactionPerformer } = getStore();

    const element = new MyElement("myid", "timothee");
    await store.save(element);
    await transactionPerformer.perform(async (transaction) => {
      const pristine = await store.load(element.id, transaction);
      expect(pristine).toBeTruthy();
      if (!pristine) {
        return;
      }
      await store.delete(pristine.id, transaction);
    });
    const pristine = await store.load(element.id);
    expect(pristine).toEqual(undefined);
  });

  it("fails transactionally read after write", async () => {
    const { store, transactionPerformer } = getStore();

    await expect(
      transactionPerformer.perform(async (transaction) => {
        const element = new MyElement("myid", "timothee");
        await store.save(element, transaction);
        await store.load(element.id, transaction);
      })
    ).rejects.toThrow(CannotReadAfterWrites);
  });

  it("fails transactionally trying 5 times to write", async () => {
    let uniqueId = 0;
    const { store, transactionPerformer } = getStore();

    const element = new MyElement("myid", "timothee");
    await store.save(element);

    let effectCalled = 0;
    await expect(
      transactionPerformer.perform(async (transaction) => {
        effectCalled += 1;
        await store.load(element.id, transaction);
        element.setName("elies");

        uniqueId += 1;
        await store.save(new MyElement(element.id, uniqueId.toString()));

        await store.save(element, transaction);
      })
    ).rejects.toThrow(TransactionCollidedTooManyTimes);
    expect(effectCalled).toBe(5);
  });

  it("transactionally writes after 1 fail", async () => {
    let uniqueId = 0;
    const { store, transactionPerformer } = getStore();

    const element = new MyElement("myid", "timothee");
    await store.save(element);

    let effectCalled = 0;
    await transactionPerformer.perform(async (transaction) => {
      effectCalled += 1;
      const loadedElement = await store.load(element.id, transaction);

      expect(loadedElement).toBeTruthy();
      if (!loadedElement) {
        return;
      }

      loadedElement.setName("elies");

      if (uniqueId === 0) {
        await store.save(new MyElement(element.id, uniqueId.toString()));
        uniqueId += 1;
      }

      await store.save(loadedElement, transaction);
    });
    expect(effectCalled).toBe(2);
  });

  it("transactionally writes after 1 fail and calls onCommit only once", async () => {
    let uniqueId = 0;
    const { store, transactionPerformer } = getStore();

    const element = new MyElement("myid", "timothee");
    await store.save(element);

    let onCommitCalled = 0;
    await transactionPerformer.perform(async (transaction) => {
      transaction.onCommit(() => {
        onCommitCalled += 1;
      });

      const loadedElement = await store.load(element.id, transaction);

      expect(loadedElement).toBeTruthy();
      if (!loadedElement) {
        return;
      }

      loadedElement.setName("elies");

      if (uniqueId === 0) {
        await store.save(new MyElement(element.id, uniqueId.toString()));
        uniqueId += 1;
      }

      await store.save(loadedElement, transaction);
    });

    expect(onCommitCalled).toBe(1);
  });
});
