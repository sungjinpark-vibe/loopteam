/**
 * Shared component-test mount helper — ADDENDUM-01 §6 (component test
 * harness, prerequisite of the road/저축 블록 tasks). The repo had no
 * component test before this; every prior `*.test.tsx` mounted a bare hook
 * harness (`useTownStore.test.tsx`, `hooks/useBackGuard.test.tsx`) with the
 * same three lines repeated inline. This factors that pattern for the first
 * real COMPONENT mount (`components/TownGrid.test.tsx`) and every one after
 * it — bare `createRoot` + `act`, no new dependency (no
 * `@testing-library/react`; see ADDENDUM-01 §2.9 for why).
 */
import type { ReactElement } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

export interface MountedComponent {
  container: HTMLDivElement;
  root: Root;
  /** Unmounts and detaches the container — call once per test, e.g. from `afterEach`. */
  unmount: () => void;
}

/** Mounts `element` synchronously inside `act` and returns the live container + an unmount helper. */
export function mountComponent(element: ReactElement): MountedComponent {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return {
    container,
    root,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}
