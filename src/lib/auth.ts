import Credentials from "next-auth/providers/credentials";
import NextAuth from "next-auth";
import { z } from "zod";
import { env } from "@/lib/env";
import { UserService } from "@/modules/users/service";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt", maxAge: env.SESSION_IDLE_TIMEOUT_MINUTES * 60 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const user = await new UserService().verifyCredentials(parsed.data.email, parsed.data.password);
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          homeDepartmentId: user.homeDepartmentId,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.homeDepartmentId = (user as { homeDepartmentId?: string | null }).homeDepartmentId ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.homeDepartmentId = token.homeDepartmentId as string | null;
      }
      return session;
    },
  },
});
