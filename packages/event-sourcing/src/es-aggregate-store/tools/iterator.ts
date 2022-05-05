export async function* map<T, U>(
  iterable: AsyncIterable<T>,
  fn: (value: T) => U
) {
  for await (const value of iterable) {
    yield fn(value);
  }
}

export function closeable<T, U>(
  iterable: AsyncIterableIterator<T>,
  onClose?: () => Promise<void>
): AsyncIterableIterator<T> & { close: () => Promise<void> } {
  const resolves = new Set<(value: unknown) => void>();
  let done = false;

  return {
    [Symbol.asyncIterator]() {
      return this;
    },
    async next() {
      if (done) {
        return { done: done };
      }

      let resolve: (value: unknown) => void;

      const next = new Promise((r) => {
        resolve = r;
        resolves.add(r);
      });

      const defer = iterable.next();

      defer.then(({ done, value }) => {
        resolves.delete(resolve);
        resolve({ done, value });
      });

      return next;
    },
    close() {
      done = true;
      for (const r of resolves) {
        r({ done: true });
      }
      return onClose?.();
    },
  } as any;
}

export async function buffer<T>(iterator: AsyncIterable<T>, count = Infinity) {
  const buffered: T[] = [];
  for await (const event of iterator) {
    buffered.push(event);
    if (buffered.length >= count) return buffered;
  }
  return buffered;
}
