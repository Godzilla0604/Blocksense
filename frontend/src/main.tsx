import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import App from "./App";
import { SelectionProvider } from "@/hooks/useSelection";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { ApiError } from "@/services/api";
import "./styles/index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      // Don't retry client errors (404/400); retry transient ones briefly.
      retry: (count, err) => !(err instanceof ApiError && err.code >= 400 && err.code < 500) && count < 2,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "") || "/"}>
        <MotionConfig reducedMotion="user">
          <TooltipProvider>
            <SelectionProvider>
              <App />
            </SelectionProvider>
          </TooltipProvider>
        </MotionConfig>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
