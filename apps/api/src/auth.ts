import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { expo } from "@better-auth/expo";
import { prisma } from "./lib/prisma.js";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3001",
  secret: process.env.BETTER_AUTH_SECRET ?? "dev-secret-change-in-production-32chars",

  emailAndPassword: {
    enabled: false,
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    apple: {
      clientId: process.env.APPLE_CLIENT_ID!,
      clientSecret: process.env.APPLE_CLIENT_SECRET!,
      appBundleIdentifier: "app.wohnly",
    },
  },

  // After OAuth callback, redirect back to the web app (not the API root)
  socialCallbackURL: process.env.APP_URL ?? "https://wohnly.app",

  plugins: [
    expo(), // Enables Expo/RN support (deep link redirects, token handling)
  ],

  trustedOrigins: [
    "wohnly://",
    "https://wohnly.app",
    "https://www.wohnly.app",
    "https://api.wohnly.app",
    // Sign in with Apple posts the OAuth callback from appleid.apple.com.
    "https://appleid.apple.com",
    "http://localhost:8081",
    "http://localhost:19006",
    "tauri://localhost",
    "http://tauri.localhost",
    "https://tauri.localhost",
  ],

  user: {
    additionalFields: {
      lang: {
        type: "string",
        required: false,
        defaultValue: "en",
      },
    },
  },
});

export type Auth = typeof auth;
