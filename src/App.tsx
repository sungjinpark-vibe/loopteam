import { lazy, Suspense } from "react";
import "./App.css";

// Dynamic import defers the ~1.1MB @toss/tds-mobile chunk (vite.config.ts)
// off the boot critical path — see HomeDemo.tsx.
const HomeDemo = lazy(() => import("./HomeDemo"));

function App() {
  return (
    <Suspense fallback={null}>
      <HomeDemo />
    </Suspense>
  );
}

export default App;
