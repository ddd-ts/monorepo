import { Collection } from "./in-memory.collection";

export class Storage {
  constructor(private collections: Map<string, Collection> = new Map()) {}

  clone() {
    const clone = new Map<string, Collection>();
    for (const [collectionName, collection] of this.collections) {
      clone.set(collectionName, collection.clone());
    }

    return new Storage(clone);
  }

  merge(other: Storage) {
    const collections = new Map<string, Collection>();
    for (const [collectionName, collection] of other.collections) {
      collections.set(
        collectionName,
        this.getCollection(collectionName).merge(collection)
      );
    }
    return new Storage(collections);
  }

  getCollection(collectionName: string): Collection {
    const collection = this.collections.get(collectionName) || new Collection();
    this.collections.set(collectionName, collection);
    return collection;
  }

  toPretty() {
    return [...this.collections.entries()]
      .map(([collectionName, collection]) => {
        return [
          'Collection: "' + collectionName + '"',
          collection.toPretty(),
        ].join("\n");
      })
      .join("\n");
  }
}
