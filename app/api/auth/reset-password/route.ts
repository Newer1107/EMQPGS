import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { z } from "zod";

const resetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8),
});

export const POST = withApiHandler(async (request) => {
  const { token, password } = resetSchema.parse(await parseJson(request));
  const hashed = crypto.createHash("sha256").update(token).digest("hex");
  const user = await prisma.user.findFirst({
    where: {
      resetTokenHash: hashed,
      resetTokenExpiry: { gt: new Date() },
    },
  });

  if (!user) throw new AppError("Invalid or expired reset token", 400);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(password, 12),
      resetTokenHash: null,
      resetTokenExpiry: null,
    },
  });

  return { message: "Password reset successful" };
});
