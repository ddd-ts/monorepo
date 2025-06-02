import { Mapping } from "../../../shape/dist";

/**
 * More advanced lock system, to handle maximum parallel processing concurrency restrictions
 */
export class Lock extends Mapping([String, String]) {
  get(k: string) {
    return this.value[k];
  }

  has(k: string) {
    return this.value[k] !== undefined;
  }

  restrains(other: Lock, strict = true): boolean {
    const { onlyLeft, onlyRight, both, bothHaveSameValues } = Lock.differences(
      this,
      other,
    );

    if (onlyLeft.length === 0) {
      if (onlyRight.length === 0) {
        if (bothHaveSameValues) {
          return strict;
        }
      }
    }

    if (onlyLeft.length > 0) {
      if (onlyRight.length === 0) {
        if (bothHaveSameValues) {
          return false;
        }
      }
    }

    if (onlyLeft.length === 0) {
      if (onlyRight.length > 0) {
        if (bothHaveSameValues) {
          return true;
        }
      }
    }

    return false;
  }

  static allKeys(left: Lock, right: Lock) {
    return new Set([...Object.keys(left.value), ...Object.keys(right.value)]);
  }

  static differences(left: Lock, right: Lock) {
    const keys = Lock.allKeys(left, right);
    const onlyLeft = [...keys].filter((k) => left.has(k) && !right.has(k));
    const onlyRight = [...keys].filter((k) => right.has(k) && !left.has(k));
    const both = [...keys].filter((k) => left.has(k) && right.has(k));

    const bothHaveSameValues = both.every((k) => left.get(k) === right.get(k));
    return {
      onlyLeft,
      onlyRight,
      both,
      bothHaveSameValues,
    };
  }
}
