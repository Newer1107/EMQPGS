import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      homeDepartmentId?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    homeDepartmentId?: string | null;
  }
}
