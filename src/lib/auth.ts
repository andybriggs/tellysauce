import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  events: {
    async signIn({ user, account }) {
      if (!account || !user?.email) return;

      const id = `${account.provider}:${account.providerAccountId}`;

      const existing = await db.query.users.findFirst({
        where: (u, { eq }) => eq(u.id, id),
      });

      const payload = {
        id,
        email: user.email,
        name: user.name ?? null,
        image: user.image ?? null,
        updatedAt: new Date(),
      };

      if (existing) {
        await db.update(users).set(payload).where(eq(users.id, id));
      } else {
        await db.insert(users).values({
          ...payload,
          createdAt: new Date(),
        });
      }
    },
  },

  callbacks: {
    // Keep your existing redirect logic
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        const u = new URL(url);
        if (u.origin === baseUrl) return url;
      } catch {}
      return baseUrl;
    },
    async jwt({ token, account }) {
      if (account)
        token.uid = `${account.provider}:${account.providerAccountId}`;
      return token;
    },
    async session({ session, token }) {
      if (token?.uid) {
        // If you want stronger typing, add a NextAuth module augmentation later
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        session.user.id = token.uid as string;
      }
      return session;
    },
  },
};
