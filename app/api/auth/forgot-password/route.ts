import crypto from "node:crypto";
import { withApiHandler } from "@/lib/api-handler";

import { prisma } from "@/lib/db";
import { z } from "zod";
import { addMinutes } from "date-fns";

const forgotPasswordSchema = z.object({ email: z.email() });

export const POST = withApiHandler(async (request) => {
  const { email } = forgotPasswordSchema.parse(await request.json());
  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashed = crypto.createHash("sha256").update(rawToken).digest("hex");
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetTokenHash: hashed,
        resetTokenExpiry: addMinutes(new Date(), 30),
      },
    });

    return { message: "Password reset link generated" };
  }

  return { message: "If the account exists, a reset link has been generated" };
});
