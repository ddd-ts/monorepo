import { MicrosecondTimestamp } from "@ddd-ts/shape";
import {
  FieldValue,
  type FirestoreDataConverter,
  Timestamp,
} from "firebase-admin/firestore";

export class DefaultConverter<T extends FirebaseFirestore.DocumentData>
  implements FirestoreDataConverter<T>
{
  public toFirestore(modelObject: T): FirebaseFirestore.DocumentData {
    return toFirestore(modelObject) as FirebaseFirestore.DocumentData;
  }

  public fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): T {
    return decodeFirebaseTimestamps(snapshot.data()) as T;
  }

  public fromFirestoreSnapshot(
    snapshot: FirebaseFirestore.DocumentSnapshot,
  ): T | undefined {
    const data = snapshot.data();
    if (!data) {
      return undefined;
    }
    return decodeFirebaseTimestamps(data) as T;
  }

  public toFirestorePartial(
    modelObject: Partial<T> | FirebaseFirestore.UpdateData<T>,
  ): FirebaseFirestore.UpdateData<T> {
    return toFirestore(modelObject) as any;
  }
}

export function toFirestore<T>(obj: T): T {
  if (obj instanceof Date) {
    if (
      "microseconds" in obj &&
      typeof (obj as any).microseconds === "bigint"
    ) {
      const microseconds = (obj as any).microseconds as bigint;
      const seconds = microseconds / 1_000_000n;
      const micros = microseconds % 1_000_000n;
      const nanoseconds = micros * 1000n; // Convert to nanoseconds
      return new Timestamp(
        Number(seconds),
        Number(nanoseconds),
      ) as unknown as T;
    }
    return obj;
  }
  if (obj instanceof FieldValue || obj?.constructor?.name === "VectorValue") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(toFirestore) as unknown as T;
  }
  if (obj instanceof Object) {
    return Object.entries(obj).reduce(
      (map, [key, value]) => {
        if (value !== undefined) {
          map[key] = toFirestore(value);
        }
        return map;
      },
      {} as { [key: string]: any },
    ) as T;
  }
  return obj;
}

/**
 * decode Firebase timestamps into Dates
 */
export function decodeFirebaseTimestamps(
  obj: FirebaseFirestore.DocumentData,
): FirebaseFirestore.DocumentData {
  if (obj instanceof Date) {
    return obj;
  }
  if (obj?.toDate) {
    const result = obj.toDate();

    if (obj?.seconds !== undefined && obj?.nanoseconds !== undefined) {
      const microseconds =
        BigInt(obj.seconds) * BigInt(1_000_000) +
        BigInt(obj.nanoseconds) / BigInt(1_000);
      (result as any).microseconds = microseconds; // Attach microseconds to the date
      return result;
    }
    return result;
  }
  if (obj?.constructor?.name === "VectorValue") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(decodeFirebaseTimestamps);
  }
  if (obj instanceof Object) {
    return Object.entries(obj).reduce(
      (map, [key, value]) => {
        map[key] = decodeFirebaseTimestamps(value);
        return map;
      },
      {} as { [key: string]: any },
    );
  }
  return obj;
}
