import type { NextAuthConfig } from "next-auth";

// Shared JWT settings must stay independent of Prisma and server-only libraries.
// Netlify runs the request proxy in an Edge Function, including Next.js 16 proxies.
export default {
  providers: [],
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    jwt: async ({ token, user, trigger, session }) => {
      if (user) token.sub = user.id;
      if (trigger === "update" && session) token.name = session.name;
      return token;
    },
    session: async ({ session, token }) => {
      if (token?.sub) session.user.id = token.sub;
      return session;
    },
  },
} satisfies NextAuthConfig;
