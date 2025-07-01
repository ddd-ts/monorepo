// import { Subtrait } from "@ddd-ts/traits";
// import { BaseHandler, Description } from "./base.handler";
// import { IEsEvent, IFact } from "../../interfaces/es-event";

// // Firestore-specific tracing handler
// export const WithTracing = <const N extends string>(
//   suffix?: N,
//   tracerName = "handler",
//   tracerVersion = "1.0.0",
// ) =>
//   Subtrait([{} as typeof BaseHandler], (base) => {
//     abstract class WithTracing extends base {
//       declare description: Description<{
//         name: "WithTracing";
//         before_process: `start OpenTelemetry span "${N}"`;
//         after_process: `end OpenTelemetry span "${N}"`;
//       }>;

//       get spanName() {
//         if (!suffix) {
//           return `${this.constructor.name}`;
//         }
//         return `${this.constructor.name}.${suffix}`;
//       }

//       getSpanAttributes(
//         events: IFact[],
//         context: this["context"],
//       ): Record<string, any> {
//         return {
//           "handler.events.count": events.length,
//           "handler.events.ids": events.map((e) => e.id.serialize()).join(","),
//           "handler.events.names": events.map((e) => e.name).join(","),
//           "handler.span.name": this.spanName,
//         };
//       }

//       async process(events: IFact[], context: this["context"]) {
//         const tracer = trace.getTracer(tracerName, tracerVersion);

//         return tracer.startActiveSpan(this.spanName, async (span) => {
//           try {
//             span.setAttributes(this.getSpanAttributes(events, context));
//             log(`WithTracing.process before span: ${this.spanName}`);

//             const result = await super.process(events, context);

//             log(`WithTracing.process after span: ${this.spanName}`);
//             span.setStatus({ code: SpanStatusCode.OK });
//             return result;
//           } catch (error) {
//             span.recordException(error as Error);
//             span.setStatus({
//               code: SpanStatusCode.ERROR,
//               message: (error as Error).message,
//             });
//             log(`WithTracing.process error in span: ${this.spanName}`, error);
//             throw error;
//           } finally {
//             span.end();
//           }
//         });
//       }
//     }
//     return WithTracing;
//   });

// // Firestore-specific metrics handler
// export const WithMetrics = <const N extends string>(
//   suffix?: N,
//   meterName = "handler",
//   meterVersion = "1.0.0",
// ) =>
//   Subtrait([{} as typeof BaseHandler], (base) => {
//     abstract class WithMetrics extends base {
//       declare description: Description<{
//         name: "WithMetrics";
//         before_process: `record metrics for processing`;
//         after_process: `update metrics after processing`;
//       }>;

//       private meter = metrics.getMeter(meterName, meterVersion);

//       private eventsProcessedCounter = this.meter.createCounter(
//         "handler.events.processed",
//         {
//           description: "Total number of events processed",
//           unit: "events",
//         },
//       );

//       private eventsFailedCounter = this.meter.createCounter(
//         "handler.events.failed",
//         {
//           description: "Total number of events that failed processing",
//           unit: "events",
//         },
//       );

//       private processingDurationHistogram = this.meter.createHistogram(
//         "handler.processing.duration",
//         {
//           description: "Duration of event processing",
//           unit: "ms",
//         },
//       );

//       private batchSizeHistogram = this.meter.createHistogram(
//         "handler.batch.size",
//         {
//           description: "Size of event batches processed",
//           unit: "events",
//         },
//       );

//       get metricPrefix() {
//         if (!suffix) {
//           return this.constructor.name;
//         }
//         return `${this.constructor.name}.${suffix}`;
//       }

//       getMetricAttributes(
//         events: IEsEvent[],
//         context: this["context"],
//       ): Record<string, any> {
//         return {
//           handler: this.metricPrefix,
//         };
//       }

//       async process(events: IEsEvent[], context: this["context"]) {
//         const startTime = Date.now();
//         const attributes = this.getMetricAttributes(events, context);

//         this.batchSizeHistogram.record(events.length, attributes);

//         try {
//           const result = await super.process(events, context);

//           this.eventsProcessedCounter.add(events.length, attributes);

//           const duration = Date.now() - startTime;
//           this.processingDurationHistogram.record(duration, attributes);
//           return result;
//         } catch (error) {
//           this.eventsFailedCounter.add(events.length, attributes);

//           const duration = Date.now() - startTime;
//           this.processingDurationHistogram.record(duration, {
//             ...attributes,
//             status: "error",
//           });
//           throw error;
//         }
//       }
//     }
//     return WithMetrics;
//   });
