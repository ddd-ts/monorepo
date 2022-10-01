import { Serializer } from "../../../framework/serialization.registry";
import { TaskId } from "../domain/task";

export class TaskIdSerializer implements Serializer<TaskId> {
  serialize(id: TaskId) {
    return id.toString();
  }

  deserialize(serialized: string) {
    return new TaskId(serialized.toString());
  }
}
