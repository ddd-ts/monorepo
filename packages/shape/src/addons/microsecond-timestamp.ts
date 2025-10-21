export class MicrosecondTimestamp {
  static MILLISECOND = new MicrosecondTimestamp(BigInt(1_000));
  static SECOND = this.MILLISECOND.mult(1000);
  static MINUTE = this.SECOND.mult(60);
  static HOUR = this.MINUTE.mult(60);
  static DAY = this.HOUR.mult(24);
  static WEEK = this.DAY.mult(7);
  static MONTH = this.DAY.mult(30);

  constructor(readonly micros: bigint) {}

  isAfter(other: MicrosecondTimestamp): boolean {
    return this.micros > other.micros;
  }

  equals(other: MicrosecondTimestamp): boolean {
    return this.micros === other.micros;
  }

  isBefore(other: MicrosecondTimestamp): boolean {
    return this.micros < other.micros;
  }

  add(micros: bigint | MicrosecondTimestamp): MicrosecondTimestamp {
    const value =
      micros instanceof MicrosecondTimestamp ? micros.micros : micros;
    return new MicrosecondTimestamp(this.micros + value);
  }

  sub(micros: bigint | MicrosecondTimestamp): MicrosecondTimestamp {
    const value =
      micros instanceof MicrosecondTimestamp ? micros.micros : micros;
    return new MicrosecondTimestamp(this.micros - value);
  }

  mult(factor: number): MicrosecondTimestamp {
    return new MicrosecondTimestamp(this.micros * BigInt(factor));
  }

  static now(): MicrosecondTimestamp {
    return new MicrosecondTimestamp(BigInt(Date.now()) * BigInt(1000));
  }

  static fromNanoseconds(nanoseconds: bigint): MicrosecondTimestamp {
    return new MicrosecondTimestamp(nanoseconds / BigInt(1000));
  }

  static fromMicroseconds(microseconds: bigint): MicrosecondTimestamp {
    return new MicrosecondTimestamp(microseconds);
  }

  static deserialize(
    serialized: Date | MicrosecondTimestamp | bigint,
  ): MicrosecondTimestamp {
    if (serialized instanceof MicrosecondTimestamp) {
      return serialized;
    }
    if (typeof serialized === "bigint") {
      return new MicrosecondTimestamp(serialized);
    }

    if (
      "microseconds" in serialized &&
      typeof serialized.microseconds === "bigint"
    ) {
      return new MicrosecondTimestamp(serialized.microseconds);
    }

    const micros = BigInt(serialized.getTime()) * BigInt(1000);
    return new MicrosecondTimestamp(micros);
  }

  serialize() {
    const date = new Date(Number(this.micros / BigInt(1000)));
    (date as any).microseconds = this.micros;
    return date;
  }

  static sort(left: MicrosecondTimestamp, right: MicrosecondTimestamp): number {
    if (left.isAfter(right)) {
      return 1;
    }
    if (left.isBefore(right)) {
      return -1;
    }
    return 0;
  }
}
