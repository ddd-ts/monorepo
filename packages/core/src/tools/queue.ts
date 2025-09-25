const end = Symbol("end");

export class Queue<T> {
  private pullQueue: Array<(value: T | typeof end) => void> = [];
  private pushQueue: Array<T> = [];
  private isClosed = false;

  _onClose: () => void = () => {};

  onClose(onClose: () => void): void {
    this._onClose = onClose;
  }

  isFlushed(): boolean {
    return this.pushQueue.length === 0;
  }

  push(value: T): void {
    const resolve = this.pullQueue.shift();
    if (resolve) {
      resolve(value);
      return;
    }

    this.pushQueue.push(value);
  }

  close(): void {
    this.isClosed = true;
    for (const resolve of this.pullQueue) {
      resolve(end);
    }
    this._onClose();
  }

  async *[Symbol.asyncIterator]() {
    while (true) {
      if (this.isClosed) {
        return;
      }
      const next = this.pushQueue.shift();
      if (next !== undefined) {
        yield next;
      } else {
        const next = await new Promise<T | typeof end>((resolve) =>
          this.pullQueue.push(resolve),
        );

        if (next === end) {
          return;
        }

        yield next;
      }
    }
  }
}
