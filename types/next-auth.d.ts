import "next-auth";
import "next-auth/jwt";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    /** Verified GitHub username (login). */
    login?: string;
    user: DefaultSession["user"] & {
      login?: string;
    };
  }

  interface User {
    login?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    login?: string;
  }
}
