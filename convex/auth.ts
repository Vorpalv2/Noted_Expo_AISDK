import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password({
    profile(params) {
      const email = params.email;
      if (typeof email !== "string") throw new Error("Enter a valid email address.");
      return { email: email.trim().toLowerCase(), theme: "light" };
    },
  })],
});
