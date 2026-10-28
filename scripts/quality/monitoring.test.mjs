import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeMonitoring} from './monitoring.mjs';

const sample = (minute, overrides = {}) => ({timestamp: new Date(Date.UTC(2026, 0, 1, 0, minute)).toISOString(),
  endpoint: 'https://example.test/', network: 'fixture-network', intervalSeconds: 600, httpStatus: 200, elapsedMs: 100, ...overrides});

test('timeouts are failures, policy refusals are gaps, and a short successful sample is not uptime certification', () => {
  const {endpoints: [endpoint]} = summarizeMonitoring([
    sample(0), sample(10, {httpStatus: null, error: {code: 'ERR_TIMEOUT'}, elapsedMs: null}),
    sample(20, {httpStatus: null, error: {code: 'ERR_ROBOTS_DENIED'}, elapsedMs: null}),
  ]);
  assert.equal(endpoint.sampleAvailabilityPercent, 50);
  assert.equal(endpoint.failedObservations, 1);
  assert.equal(endpoint.excludedPolicyOrUnknownSamples, 1);
  assert.equal(endpoint.periodReached28Days, false);
  assert.equal(endpoint.completeDeclaredSchedule, false);
  assert.equal(endpoint.status, 'Provisional');
});

test('a 28-day span with an observation gap cannot masquerade as complete monitoring', () => {
  const {endpoints: [endpoint]} = summarizeMonitoring([sample(0), sample(28 * 24 * 60)]);
  assert.equal(endpoint.periodReached28Days, true);
  assert.equal(endpoint.completeDeclaredSchedule, false);
  assert.equal(endpoint.observationGaps[0].estimatedMissingObservations, 4031);
});

test('changed endpoint intervals prevent schedule completeness and endpoints remain separate', () => {
  const {endpoints} = summarizeMonitoring([sample(0), sample(10, {intervalSeconds: 300}), sample(20, {endpoint: 'https://example.test/service'})]);
  assert.equal(endpoints[0].inconsistentDeclaredIntervals, true);
  assert.equal(endpoints[0].intervalSeconds, null);
  assert.equal(endpoints[0].completeDeclaredSchedule, false);
  assert.equal(endpoints[1].samples, 1);
});

test('invalid observation dates are rejected instead of generating misleading statistics', () => {
  assert.throws(() => summarizeMonitoring([sample(0, {timestamp: 'not-a-date'})]), /valid timestamp/);
});
