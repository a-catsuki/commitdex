import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      profile(profile) {
        return {
          id: String(profile.id),
          name: profile.name ?? profile.login,
          email: profile.email,
          image: profile.avatar_url,
          login: profile.login,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user, profile }) {
      if (user?.login) token.login = user.login;
      if (
        profile &&
        typeof profile === "object" &&
        "login" in profile &&
        typeof profile.login === "string"
      ) {
        token.login = profile.login;
      }
      return token;
    },
    session({ session, token }) {
      if (typeof token.login === "string" && token.login) {
        session.login = token.login;
        if (session.user) session.user.login = token.login;
      }
      return session;
    },
  },
  trustHost: true,
});
