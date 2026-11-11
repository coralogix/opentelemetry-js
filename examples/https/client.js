'use strict';

const fs = require('fs');
const https = require('https');
const path = require('path');
const { trace } = require('@opentelemetry/api');

const tracer = trace.getTracer('example-https');

// Trust only this example's self-signed certificate. Its subject CN is "ca".
const ca = fs.readFileSync(path.join(__dirname, 'server-cert.pem'));

/** A function which makes requests and handles response. */
function makeRequest() {
  // span corresponds to outgoing requests. Here, we have manually created
  // the span, which is created to track work that happens outside of the
  // request lifecycle entirely.
  tracer.startActiveSpan('makeRequest', (span) => {
    https.get({
      host: 'localhost',
      port: 8443,
      path: '/helloworld',
      ca,
      servername: 'ca',
    }, (response) => {
      const body = [];
      response.on('data', (chunk) => body.push(chunk));
      response.on('end', () => {
        console.log(body.toString());
        span.end();
      });
    });
  });

  // The process must live for at least the interval past any traces that
  // must be exported, or some risk being lost if they are recorded after the
  // last export.
  console.log('Sleeping 5 seconds before shutdown to ensure all records are flushed.');
  setTimeout(() => { console.log('Completed.'); }, 5000);
}

makeRequest();
