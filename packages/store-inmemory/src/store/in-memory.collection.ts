function now() {
  if (typeof process === "object" && typeof process.hrtime === "function") {
    return process.hrtime.bigint();
  }
  return Date.now();
}

export class Collection {
  constructor(
    private data: Map<string, { savedAt: number; data: any }> = new Map(),
  ) {}

  clear() {
    this.data.clear();
  }

  getLatestSnapshot(id: string) {
    const data = [...this.data.values()];
    const sameId = data.filter((d) => d.data.id === id);
    const sorted = sameId.sort((a, b) => b.savedAt - a.savedAt);
    return sorted[0]?.data;
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

  getRaw(id: string) {
    return this.data.get(id);
  }

  countAll() {
    return this.data.size;
  }

  get(id: string): any {
    return this.data.get(id)?.data;
  }

  getAllRaw() {
    return [...this.data.entries()].map(([id, data]) => ({ id, data }));
  }

  getAll(): any[] {
    return [...this.data.entries()].map(([id, data]) => data.data);
  }

  save(id: string, data: any): void {
    this.data.set(id, { savedAt: Number(now()), data });
  }

  toPretty() {
    return [...this.data.entries()]
      .map(
        ([id, data]) =>
          `\t\t"${id}": ${JSON.stringify(data.data, replaceBigInt)}`,
      )
      .join(",\n");
  }
}

function replaceBigInt(key: string, value: any) {
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
}
