export async function* combine<T>(iterables: AsyncIterable<T>[]) {
  function getNext(asyncIterator: AsyncIterator<T>) {
    return asyncIterator.next().then((result) => ({
      asyncIterator,
      result,
    }));
  }

  const asyncIterators = new Map(iterables.map((iterable) => {
    const iterator = iterable[Symbol.asyncIterator]();
    return [iterator, getNext(iterator)]
  }));

  while (asyncIterators.size > 0) {
    const { asyncIterator, result } = await Promise.race(asyncIterators.values());

    if (result.done) {
      if (asyncIterator.return) {
        asyncIterator.return().catch(console.error);
      }
      asyncIterators.delete(asyncIterator)
    } else {
      asyncIterators.set(asyncIterator, getNext(asyncIterator));
      yield result.value;
    }
  }
}

export async function* batch<T>(iterator: AsyncIterable<T>, size: number) {
  let batch = [];

  for await (const item of iterator) {
    batch.push(item);
    if (batch.length === size) {
      yield batch;
      batch = [];
    }
  }
  if (batch.length > 0) {
    yield batch;
  }
}
