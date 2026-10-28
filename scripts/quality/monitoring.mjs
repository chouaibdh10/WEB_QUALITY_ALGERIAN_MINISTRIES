const NETWORK_ERRORS = new Set(['ERR_DNS', 'ERR_DNS_TIMEOUT', 'ERR_NETWORK', 'ERR_TIMEOUT', 'ERR_RESPONSE_ABORTED']);
const percentile = (values, p) => values.length ? values[Math.max(0, Math.ceil(values.length * p) - 1)] : null;

export function summarizeMonitoring(records) {
  const grouped = new Map();
  for (const record of records) {
    if (!record || !Number.isFinite(Date.parse(record.timestamp)) || !record.endpoint || !Number.isInteger(record.intervalSeconds) || record.intervalSeconds < 60) {
      throw new Error('Monitoring records require a valid timestamp, endpoint and declared intervalSeconds >= 60');
    }
    const entries = grouped.get(record.endpoint) ?? [];
    entries.push(record);
    grouped.set(record.endpoint, entries);
  }
  const endpoints = [...grouped.entries()].map(([endpoint, entries]) => {
    entries.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    const intervals = [...new Set(entries.map(entry => entry.intervalSeconds))];
    const networks = [...new Set(entries.map(entry => entry.network).filter(network => network && network !== 'Not supplied'))];
    const intervalSeconds = intervals.length === 1 ? intervals[0] : null;
    const times = entries.map(entry => Date.parse(entry.timestamp));
    const spanSeconds = (times.at(-1) - times[0]) / 1000;
    const gaps = [];
    for (let index = 1; index < times.length; index++) {
      const seconds = (times[index] - times[index - 1]) / 1000;
      if (intervalSeconds && seconds > intervalSeconds * 1.5) gaps.push({from: entries[index - 1].timestamp, to: entries[index].timestamp, seconds,
        estimatedMissingObservations: Math.max(1, Math.round(seconds / intervalSeconds) - 1)});
    }
    const observed = entries.filter(entry => Number.isInteger(entry.httpStatus) || NETWORK_ERRORS.has(entry.error?.code));
    const successful = observed.filter(entry => entry.httpStatus >= 200 && entry.httpStatus < 400);
    const responseTimes = observed.map(entry => entry.elapsedMs).filter(value => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
    const middle = responseTimes.length / 2;
    return {endpoint, samples: entries.length, observations: observed.length, excludedPolicyOrUnknownSamples: entries.length - observed.length,
      successfulObservations: successful.length, failedObservations: observed.length - successful.length,
      sampleAvailabilityPercent: observed.length ? successful.length / observed.length * 100 : null,
      firstObservation: entries[0].timestamp, lastObservation: entries.at(-1).timestamp, spanSeconds, intervalSeconds,
      inconsistentDeclaredIntervals: intervals.length !== 1, distinctDeclaredNetworks: networks.length,
      responseTimeMs: {median: responseTimes.length ? (responseTimes[Math.floor((responseTimes.length - 1) / 2)] + responseTimes[Math.floor(middle)]) / 2 : null,
        p90: percentile(responseTimes, 0.9), p95: percentile(responseTimes, 0.95), count: responseTimes.length},
      observationGaps: gaps,
      periodReached28Days: spanSeconds >= 28 * 86400,
      completeDeclaredSchedule: Boolean(intervalSeconds && spanSeconds >= 28 * 86400 && gaps.length === 0 && observed.length === entries.length),
      status: 'Provisional',
    };
  });
  return {samples: records.length, endpoints, status: 'Provisional',
    note: 'Sample availability is observed requests only, not continuous uptime. Policy refusals/unknown errors are excluded, never counted as success. Gaps, maintenance, identity, endpoint sampling and independently verified network labels require review; no automatic reliability points or Final status.'};
}
