import { StoreSuite, MyElementSerializer, MyElement } from "../store.suite";
import {
	InMemoryStore,
	InMemoryDatabase,
	InMemoryTransactionPerformer,
	CannotReadAfterWrites,
	TransactionCollidedTooManyTimes,
} from "@ddd-ts/store-inmemory";

class MyElementStore extends InMemoryStore<MyElement> {
	constructor(database: InMemoryDatabase) {
		super("my_collection", database, new MyElementSerializer());
	}

	loadEven() {
		return this.filter((e) => e.even);
	}
}

describe("InMemoryStore", () => {
	function getStore() {
		const database = new InMemoryDatabase();
		return {
			store: new MyElementStore(database),
			transactionPerformer: new InMemoryTransactionPerformer(database),
		};
	}

	StoreSuite(getStore);

	it("fails transactionally read after write", async () => {
		const { store, transactionPerformer } = getStore();

		await expect(
			transactionPerformer.perform(async (transaction) => {
				const element = new MyElement("myid", "timothee", false);
				await store.save(element, transaction);
				await store.load(element.id, transaction);
			}),
		).rejects.toThrow(CannotReadAfterWrites);
	});

	it("fails transactionally trying 5 times to write", async () => {
		let uniqueId = 0;
		const { store, transactionPerformer } = getStore();

		const element = new MyElement("myid", "timothee", false);
		await store.save(element);

		let effectCalled = 0;
		await expect(
			transactionPerformer.perform(async (transaction) => {
				effectCalled += 1;
				await store.load(element.id, transaction);
				element.setName("elies");

				uniqueId += 1;
				await store.save(new MyElement(element.id, uniqueId.toString(), false));

				await store.save(element, transaction);
			}),
		).rejects.toThrow(TransactionCollidedTooManyTimes);
		expect(effectCalled).toBe(5);
	});

	it("transactionally writes after 1 fail", async () => {
		let uniqueId = 0;
		const { store, transactionPerformer } = getStore();

		const element = new MyElement("myid", "timothee", false);
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
				await store.save(new MyElement(element.id, uniqueId.toString(), false));
				uniqueId += 1;
			}

			await store.save(loadedElement, transaction);
		});
		expect(effectCalled).toBe(2);
	});

	it("transactionally writes after 1 fail and calls onCommit only once", async () => {
		let uniqueId = 0;
		const { store, transactionPerformer } = getStore();

		const element = new MyElement("myid", "timothee", false);
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
				await store.save(new MyElement(element.id, uniqueId.toString(), false));
				uniqueId += 1;
			}

			await store.save(loadedElement, transaction);
		});

		expect(onCommitCalled).toBe(1);
	});
});
