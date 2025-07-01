const { trace, context, metrics } = require("@opentelemetry/api");
const { NodeSDK, metrics: Metrics } = require("@opentelemetry/sdk-node");
const {
  OTLPTraceExporter,
} = require("@opentelemetry/exporter-trace-otlp-grpc");
const {
  OTLPMetricExporter,
} = require("@opentelemetry/exporter-metrics-otlp-grpc");
const { Resource } = require("@opentelemetry/resources");
const { HttpInstrumentation } = require("@opentelemetry/instrumentation-http");

let sdk = null;
let initialized = false;

let flush = () => Promise.resolve();

class ImmediateMetricReader extends Metrics.MetricReader {
  constructor(exporter) {
    super();
    this._exporter = exporter;
  }

  async _runOnceAndExport() {
    const result = await this.collect();
    if (result.resourceMetrics.length > 0) {
      await this._exporter.export(result);
    }
  }

  async shutdown() {
    try {
      await this._runOnceAndExport();
      await this._exporter.shutdown();
    } catch {}
  }

  // Export immediately when metrics are collected
  async onForceFlush() {
    await this._runOnceAndExport();
  }
}
// Initialize OpenTelemetry once per test file
beforeAll(async () => {
  if (initialized) {
    return;
  }

  try {
    // Create resource - filter out process-specific attributes for coherent time series
    const defaultResource = Resource.empty();

    const resource = defaultResource;

    // Create trace exporter
    const traceExporter = new OTLPTraceExporter({
      url: "http://localhost:4317",
    });

    // Create metric exporter with debugging
    const metricExporter = new OTLPMetricExporter({
      url: "http://localhost:4317",
    });

    const metricReader = new ImmediateMetricReader(metricExporter);

    // console.log(`📊 [NODE-SDK] Created ImmediateMetricReader`);

    // Create the Node SDK with all configuration
    sdk = new NodeSDK({
      resource,
      traceExporter,
      resourceDetectors: [],
      metricReader: metricReader,
      instrumentations: [
        new HttpInstrumentation({
          ignoreIncomingRequestHook: () => false,
          ignoreOutgoingRequestHook: () => false,
        }),
      ],
    });

    // Start the SDK
    sdk.start();

    initialized = true;

    flush = async () => {
      await metricReader.forceFlush();
      await metricExporter.forceFlush();
      await traceExporter.forceFlush();
    };
  } catch (error) {
    console.error("❌ Failed to initialize OpenTelemetry Node SDK:", error);
    throw error;
  }
});

// Cleanup after all tests
afterAll(async () => {
  if (sdk) {
    try {
      await flush();
      await sdk.shutdown();
    } catch (error) {
      console.error("❌ Error during OpenTelemetry Node SDK shutdown:", error);
    }
  }
});

// Store original it function
const originalIt = global.it;

// Create test metrics
let testMeter = null;
let testCounter = null;
let testDurationHistogram = null;

// Wrap it() to create test spans and handle context propagation
global.it = (name, fn, timeout) =>
  originalIt(
    name,
    async (...args) => {
      if (!sdk) {
        // Fallback if OpenTelemetry not initialized
        return fn(...args);
      }

      // Initialize test metrics if not already done
      if (!testMeter) {
        testMeter = metrics.getMeter("test-metrics", "1.0.0");
        testCounter = testMeter.createCounter("test_executions", {
          description: "Number of test executions",
          unit: "tests",
        });
        testDurationHistogram = testMeter.createHistogram("test_duration", {
          description: "Test execution duration",
          unit: "ms",
        });
      }

      const startTime = Date.now();

      // Create test span
      const tracer = trace.getTracer("test-spans", "1.0.0");
      const testSpan = tracer.startSpan(`test:${name}`, {
        attributes: {
          "test.name": name,
          "test.framework": "jest",
          "test.type": "integration",
          "test.status": "running",
        },
      });

      // Create context with test span
      const testContext = trace.setSpan(context.active(), testSpan);

      let testResult = "passed";
      let testError = null;

      try {
        // Run the test within the span context
        const result = await context.with(testContext, () => fn(...args));
        return result;
      } catch (error) {
        testResult = "failed";
        testError = error;
        throw error;
      } finally {
        // Always end the span
        const duration = Date.now() - startTime;

        testSpan.setAttributes({
          "test.result": testResult,
          "test.duration_ms": duration,
        });

        if (testError) {
          testSpan.setAttributes({
            "test.error.message": testError.message,
            "test.error.name": testError.name,
          });
        }

        testSpan.setStatus({
          code: testResult === "passed" ? 1 : 2, // OK : ERROR
        });

        testSpan.end();

        // Record test metrics
        if (testCounter && testDurationHistogram) {
          const metricAttributes = {
            test_name: name,
            test_result: testResult,
            test_framework: "jest",
          };

          testCounter.add(1, metricAttributes);
          testDurationHistogram.record(duration, metricAttributes);
        }

        await flush();
      }
    },
    timeout,
  );

global.test = global.it;
