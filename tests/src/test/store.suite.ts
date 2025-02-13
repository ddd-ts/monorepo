import {
  ISerializer,
  Serialized,
  Store,
  TransactionPerformer,
} from "@ddd-ts/core";
import { Primitive } from "@ddd-ts/shape";

export class MyElementId extends Primitive(String) {}

// biome-ignore lint/suspicious/noExportsInTest: <explanation>
export class MyElement {
  constructor(
    public readonly id: MyElementId,
    public name: string,
    public readonly even: boolean,
  ) {}

  public setName(name: string) {
    this.name = name;
  }
}

// biome-ignore lint/suspicious/noExportsInTest: <explanation>
export class MyElementSerializer implements ISerializer<MyElement> {
  serialize(value: MyElement) {
    return {
      version: 1,
      id: value.id.serialize(),
      name: value.name,
      even: value.even,
    };
  }

  deserialize(value: Serialized<this>) {
    return new MyElement(MyElementId.deserialize(value.id), value.name, value.even);
  }
}

interface LoadEvenStore extends Store<MyElement> {
  loadEven: () => Promise<MyElement[]>;
}

// biome-ignore lint/suspicious/noExportsInTest: <explanation>
export function StoreSuite(
  getStore: () => {
    store: LoadEvenStore;
    transactionPerformer: TransactionPerformer;
  },
) {
  it("saves", async () => {
    const { store } = getStore();

    const element = new MyElement(MyElementId.deserialize("myid"), "timothee", false);
    await store.save(element);
  });

  it("loads", async () => {
    const { store } = getStore();

    const element = new MyElement(MyElementId.deserialize("myid"), "timothee", false);
    await store.save(element);
    const pristine = await store.load(element.id);
    expect(pristine).toEqual(element);
  });

  it("filters", async () => {
    const { store } = getStore();

    const elements = [...Array.from({ length: 100 }).keys()].map(
      (_, index) =>
        new MyElement(
          MyElementId.deserialize(index.toString()),
          `name-${index.toString()}`,
          index % 2 === 0,
        ),
    );
    await Promise.all(elements.map((e) => store.save(e)));
    const onlyEven = await store.loadEven();
    expect(onlyEven.length).toBe(50);
    expect(onlyEven.map((e) => e.name).sort()).toEqual(
      [...Array.from({ length: 50 }).keys()]
        .map((_, index) => `name-${(index * 2).toString()}`)
        .sort(),
    );
  });

  it("deletes", async () => {
    const { store } = getStore();

    const element = new MyElement(MyElementId.deserialize("myid"), "timothee", false);
    await store.save(element);
    const pristine = await store.delete(element.id);
    expect(pristine).toEqual(undefined);
  });

  it("transactionally writes", async () => {
    const { store, transactionPerformer } = getStore();

    const element = new MyElement(MyElementId.deserialize("myid"), "timothee", false);
    await transactionPerformer.perform(async (transaction) => {
      await store.save(element, transaction);
    });
    const pristine = await store.load(element.id);
    expect(pristine).toEqual(element);
  });

  it("transactionally deletes", async () => {
    const { store, transactionPerformer } = getStore();

    const element = new MyElement(MyElementId.deserialize("myid"), "timothee", false);
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

  it("streams all documents using streamAll", async () => {
    const { store } = getStore();

    const elements = [...Array.from({ length: 100 }).keys()].map(
      (_, index) =>
        new MyElement(
          MyElementId.deserialize(index.toString()),
          `name-${index.toString()}`,
          index % 2 === 0,
        ),
    );
    await Promise.all(elements.map((e) => store.save(e)));
    const streamed: string[] = [];
    for await (const element of store.streamAll()) {
      streamed.push(element.name);
    }
    expect(streamed.length).toBe(100);
    expect(streamed.sort()).toEqual(
      [...Array.from({ length: 100 }).keys()]
        .map((_, index) => `name-${index.toString()}`)
        .sort(),
    );
  });
}
