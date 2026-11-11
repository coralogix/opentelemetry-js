const axios = require("axios");
const { W3CTraceContextPropagator } = require("@opentelemetry/core");
const { TracerProvider } = require("@opentelemetry/sdk-trace");
const { context, propagation, trace, ROOT_CONTEXT } = require("@opentelemetry/api");
const {
  AsyncLocalStorageContextManager,
} = require("@opentelemetry/context-async-hooks");
const bodyParser = require("body-parser");

// set global propagator
propagation.setGlobalPropagator(new W3CTraceContextPropagator());

// set global context manager
context.setGlobalContextManager(new AsyncLocalStorageContextManager());

// set global tracer provider
trace.setGlobalTracerProvider(new TracerProvider());

// Get a tracer
const tracer = trace.getTracer("w3c-tests");

// --- Simple Express app setup
const express = require("express");
const port = 5000;
const app = express();

app.use(bodyParser.json());

// Mount our demo route
app.post("/verify-tracecontext", (req, res) => {
  context.with(propagation.extract(ROOT_CONTEXT, req.headers), () => {
    Promise.all(
      req.body.map((action) => {
        const callback = new URL(action.url);
        if (callback.origin !== "http://127.0.0.1:7777") {
          throw new Error("Unsupported W3C harness callback origin");
        }
        const span = tracer.startSpan("propagate-w3c");
        let promise;
        context.with(trace.setSpan(context.active(), span), () => {
          const headers = {};
          propagation.inject(context.active(), headers);
          promise = axios
            .post(
              `http://127.0.0.1:7777/${encodeURIComponent(callback.pathname.slice(1))}`,

              [...action.arguments],

              {
                headers,
                timeout: 10,
                maxRedirects: 0,
              }
            )
            .finally(() => {
              span.end();
            });
        });
        return promise;
      })
    )
    .then(() => res.send("hello"))
    .catch((err) => res.status(500).send(err));
  });
});

// Start the server
app.listen(port, () =>
  console.log(`W3c test server listening on port ${port}!`)
);
