/* Test helper: render with a fresh React Query client, the toast provider and
   the skills + agents i18n namespaces. Pair with `vi.mock("@/lib/api")` to
   assert request payloads through the real hooks. */
import React from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { ToastProvider } from "@/lib/toast";
import skills from "../../messages/en/skills.json";
import agents from "../../messages/en/agents.json";

export function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={{ skills, agents }}>
        <ToastProvider>{children}</ToastProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
  const result = render(ui, { wrapper });
  return { ...result, qc };
}
