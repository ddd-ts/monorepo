import { Serializer } from "../../../framework/serialization.registry";
import { Task, TaskId } from "../domain/task";

export class TaskSerializer implements Serializer<Task> {
  constructor(private readonly taskIdSerializer: Serializer<TaskId>) {}

  serialize(instance: Task) {
    return {
      id: this.taskIdSerializer.serialize(instance.taskId),
      name: instance.name,
    };
  }

  deserialize(serialized: ReturnType<this["serialize"]>) {
    return new Task(
      this.taskIdSerializer.deserialize(serialized.id),
      serialized.name
    );
  }
}
