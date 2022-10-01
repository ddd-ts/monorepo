export class TaskId {
  constructor(public readonly value: string) {}

  static generate() {
    return new TaskId(Math.random().toString().substring(2, 8));
  }

  toString() {
    return this.value;
  }
}

export class TaskName {
  constructor(public readonly value: string) {}

  static fromString(value: string) {
    return new TaskName(value);
  }

  toString() {
    return this.value;
  }
}

export class Task {
  constructor(public readonly taskId: TaskId, public readonly name: TaskName) {}

  static new(name: TaskName) {
    return new Task(TaskId.generate(), name);
  }
}
