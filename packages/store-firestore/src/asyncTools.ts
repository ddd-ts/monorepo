export async function* combine<T>(iterable: AsyncIterable<T>[]) {
  const asyncIterators = Array.from(iterable, (o) => o[Symbol.asyncIterator]());
  let count = asyncIterators.length;
  const never = new Promise<any>(() => { });
  function getNext(asyncIterator: AsyncIterator<any>, index: number) {
    return asyncIterator.next().then((result) => ({
      index,
      result,
    }));
  }
  const nextPromises = asyncIterators.map(getNext);
  try {
    while (count) {
      const { index, result } = await Promise.race(nextPromises);
      if (result.done) {
        nextPromises[index] = never;
        count--;
      } else {
        nextPromises[index] = getNext(asyncIterators[index]!, index);
        yield result.value;
      }
    }
  } finally {
    for (const [index, iterator] of asyncIterators.entries()) {
      if (nextPromises[index] !== never && iterator.return != null) {
        iterator.return().catch(console.error);
      }
    }
    // no await here - see https://github.com/tc39/proposal-async-iteration/issues/126
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
