export class Collection {
  constructor(private data: Map<string, any> = new Map()) {}

  clear() {
    this.data.clear();
  }

  clone() {
    const clone = new Map();
    for (const [key, value] of this.data) {
      clone.set(key, value);
    }
    return new Collection(clone);
  }

  merge(other: Collection) {
    const merge = new Map();
    for (const [key, value] of this.data) {
      merge.set(key, value);
    }
    for (const [key, value] of other.data) {
      merge.set(key, value);
    }
    return new Collection(merge);
  }

  delete(id: string): void {
    this.data.delete(id);
  }

  get(id: string): any {
    return this.data.get(id);
  }

  getAll(): any[] {
    return [...this.data.entries()];
  }

  save(id: string, data: any): void {
    this.data.set(id, data);
  }

  toPretty() {
    return [...this.data.entries()]
      .map(([id, data]) => {
        return `\t\t"${id}": ${JSON.stringify(data)}`;
      })
      .join(",\n");
  }
}
