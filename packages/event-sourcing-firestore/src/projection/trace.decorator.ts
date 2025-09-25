import { trace, SpanStatusCode } from "@opentelemetry/api";

export function Trace<U, const Fn extends (...args: any[]) => Promise<any>>(
  spanName: string,
  attributes?: (target: U, ...args: Parameters<Fn>) => Record<string, any>,
) {
  return (
    _target: U,
    _propertyKey: string,
    descriptor: TypedPropertyDescriptor<Fn>,
  ) => {
    const originalMethod = descriptor.value;

    (descriptor as any).value = async function (...args: Parameters<Fn>) {
      const tracer = trace.getTracer("projector", "1.0.0");

      return tracer.startActiveSpan(spanName, async (span) => {
        try {
          if (attributes) {
            span.setAttributes(attributes(this, ...args));
          }

          const result = await (originalMethod as any).apply(this, args);
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: (error as Error).message,
          });
          throw error;
        } finally {
          span.end();
        }
      });
    };

    return descriptor;
  };
}
