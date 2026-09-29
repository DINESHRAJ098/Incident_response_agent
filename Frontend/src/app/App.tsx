import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import { Toaster } from "@/components/ui/sonner";
import { ErrorBoundary } from "./ErrorBoundary";

// Route-level code splitting: the landing page never downloads console code.
const Landing = lazy(() => import("@/pages/Landing"));
const Console = lazy(() => import("@/pages/Console"));
const NotFound = lazy(() => import("@/pages/NotFound"));

function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

/**
 * Routes:  `/` landing page · `/console` the Incident AI product surface.
 * There is no sign-in and no database in the frontend — every backend call
 * goes to the agent API through `src/services/agent`.
 */
export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/console" element={<Console />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        <Toaster theme="dark" />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
