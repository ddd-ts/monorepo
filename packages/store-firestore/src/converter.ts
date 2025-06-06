import { FieldValue, FirestoreDataConverter } from "firebase-admin/firestore";

export class DefaultConverter<T extends FirebaseFirestore.DocumentData>
  implements FirestoreDataConverter<T>
{
  public toFirestore(modelObject: T): FirebaseFirestore.DocumentData {
    return removeUndefined(modelObject);
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
    return removeUndefined(modelObject) as any;
  }
}

export function removeUndefined<T>(obj: T): T {
  if (
    obj instanceof Date ||
    obj instanceof FieldValue ||
    obj?.constructor?.name === "VectorValue"
  ) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined) as unknown as T;
  }
  if (obj instanceof Object) {
    return Object.entries(obj).reduce(
      (map, [key, value]) => {
        if (value !== undefined) {
          map[key] = removeUndefined(value);
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
    result.inner = obj;
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
