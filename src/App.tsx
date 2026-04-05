import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import AboutVerifier from "./pages/AboutVerifier";
import NotFound from "./pages/NotFound";
import VerifyCertificate from "./pages/VerifyCertificate";
import VerifyExecution from "./pages/VerifyExecution";
import VerificationGuarantees from "./pages/VerificationGuarantees";
import { AuditPage } from "./components/AuditPage";
import { AuditLogPage } from "./components/AuditLogPage";
import { AuditLayout } from "./components/AuditLayout";
import { ThemeProvider } from "./components/ThemeProvider";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/about" element={<AboutVerifier />} />
          <Route path="/verification-guarantees" element={<VerificationGuarantees />} />
          <Route path="/c/:certificateHash" element={<VerifyCertificate />} />
          <Route path="/e/:executionId" element={<VerifyExecution />} />
          <Route path="/audit/:hash" element={
            <AuditLayout>
              <AuditPage />
            </AuditLayout>
          } />
          <Route path="/audit-log" element={
            <AuditLayout>
              <AuditLogPage />
            </AuditLayout>
          } />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ThemeProvider>
);

export default App;
