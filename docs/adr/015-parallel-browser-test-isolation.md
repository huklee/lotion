# ADR-015: Parallel browser-test isolation

Recorded: 2026-09-15. Release: 0.3.0 test infrastructure.

## Context

The browser suite ran every case serially through one server on port 3101 and one temporary repository. That avoided cross-test writes but made 105 Chromium, Firefox and WebKit cases take 2.9 minutes locally. Simply raising Playwright's worker count would let tests mutate the same page tree and documents concurrently, making failures order-dependent.

## Decision

- Enable Playwright's `fullyParallel` scheduling across tests and browser projects.
- Give each worker its own Fastify application, operating-system-assigned localhost port, and freshly initialized temporary repository through a worker-scoped fixture. Supply that worker URL through Playwright's existing `baseURL` fixture.
- Close the server and recursively remove only its resolved temporary directory during fixture teardown, including startup failures. The application `data/` directory is never used.
- Use 50% of detected logical CPUs for local runs. Use two workers in CI to match the standard GitHub-hosted runner's constrained CPU and memory. Allow explicit `--workers=N` only for capacity benchmarking.
- Keep retries disabled so parallelization cannot hide nondeterministic failures.

## Alternatives

- Keep one shared server and one worker: safest but retains the measured bottleneck.
- Share one server while namespacing test records: requires product-level tenancy that the single-workspace application does not have and still shares mutable tree state.
- Run one server per test: stronger isolation but repeats startup/teardown 105 times instead of amortizing it across a worker.
- Use all logical CPUs: an eight-worker trial on the 8-core/8-GiB development machine caused five Firefox timeouts through resource contention, so this was not stable.

## Consequences

The four-worker local suite passed 105/105 cases in 90.79 seconds, down from 174 seconds: 47.8% less wall time and a 1.92× speedup. Tests cannot intentionally depend on data created by another test, which is the desired independence boundary. Parallel runs use more peak CPU and memory and create multiple short-lived localhost servers; dynamic ports prevent collisions. Any future global external dependency must receive an equivalent worker-local isolation strategy before entering this suite.

## Validation

Exact commands, environment, the successful four-worker result and rejected eight-worker probe are recorded in [test results](../test-results.md). Revisit the worker policy when CI runner resources change or measurements show a faster stable value.
