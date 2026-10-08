import { createTRPCClient, httpBatchLink } from "@trpc/client"
import type { AppRouter } from "@/server/router"

export const trpc = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: "/trpc" })],
})
