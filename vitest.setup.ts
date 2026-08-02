// React's `act()` (used by the .test.tsx hook-harness tests) needs this flag
// set on the test environment, or it warns and its effect-flushing guarantees
// aren't reliable. https://react.dev/warnings/react-dom-test-utils
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
