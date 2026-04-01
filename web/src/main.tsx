import { createRoot } from "react-dom/client";
import { Component, type ReactNode } from "react";
import App from "./App.tsx";
import "./index.css";

// [FIX] Global Chunk Load Error Handler (Vite/Rollup specific)
// This catches 404s on lazy-loaded chunks before React even sees them.
window.addEventListener("error", (event) => {
  // Check if the error is related to loading a script/module
  if (
    event.message &&
    (event.message.includes("Loading chunk") ||
      event.message.includes("Importing a module") ||
      event.message.includes("Failed to fetch dynamically imported module"))
  ) {
    console.warn("Chunk load error detected. Forcing reload...");

    // Prevent infinite loops: Only reload if we haven't done so recently
    const lastReload = sessionStorage.getItem("chunk_reload_ts");
    const now = Date.now();

    if (!lastReload || now - parseInt(lastReload) > 5000) {
      sessionStorage.setItem("chunk_reload_ts", String(now));
      // Force reload from server (bypass cache)
      window.location.reload();
    }
  }
});

// Global Error Boundary for Chunk Loading Failures
class GlobalErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: any }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    const isChunkError =
      error?.message?.includes("Loading chunk") ||
      error?.message?.includes("Importing a module") ||
      error?.message?.includes("Failed to fetch dynamically imported module");
    return { hasError: true, error, isChunkError };
  }

  componentDidCatch(error: any) {
    console.error("Global Error Caught:", error);
    const isChunkError =
      error?.message?.includes("Loading chunk") ||
      error?.message?.includes("Importing a module") ||
      error?.message?.includes("Failed to fetch dynamically imported module");

    if (isChunkError) {
      const lastReload = sessionStorage.getItem("chunk_reload_ts");
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload) > 10000) {
        sessionStorage.setItem("chunk_reload_ts", String(now));
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;
      return (
        <div
          style={{
            height: "100vh",
            width: "100vw",
            backgroundColor: "#1a1a18",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#e5e5e5",
            padding: "24px",
          }}
        >
          <h2>{isDev ? "Runtime Error" : "Update Required"}</h2>
          {isDev && this.state.error && (
            <pre style={{
              color: "#ef4444",
              fontSize: "13px",
              maxWidth: "800px",
              overflow: "auto",
              backgroundColor: "#0a0a0a",
              padding: "16px",
              borderRadius: "8px",
              border: "1px solid #2a2a2a",
              marginBottom: "20px",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}>
              {this.state.error?.message || String(this.state.error)}
              {"\n\n"}
              {this.state.error?.stack}
            </pre>
          )}
          {!isDev && (
            <p style={{ color: "#9ca3af", marginBottom: "20px" }}>
              New version detected. Refreshing...
            </p>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 20px",
              background: "#39BDF8",
              color: "black",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Reload Now
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <GlobalErrorBoundary>
    <App />
  </GlobalErrorBoundary>
);
