import { withApiHandler } from "@/lib/api-handler";
import { getOrCreateCsrfToken } from "@/lib/csrf";

export const GET = withApiHandler(async () => {
  const csrfToken = await getOrCreateCsrfToken();
  return { csrfToken };
});
