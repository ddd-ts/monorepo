import { InMemoryExplicitAggregateStore } from "../../../framework/in-memory.explicit.aggregate.store";
import { Task } from "../domain/task";
import { TaskSerializer } from "./task.serializer";

export class InMemoryTaskStore extends InMemoryExplicitAggregateStore<
  Task,
  TaskSerializer
> {
  identify(task: Task) {
    return task.taskId;
  }
}
