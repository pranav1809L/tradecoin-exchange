import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { cancelOrder, placeLimitOrder } from "./trading";
import { getAccountOverview, getMarket, getPublicProfile, getTrendingOverview, listAllTrades, listProducts, searchProfiles, updateUserName, updateUserProfile } from "./db";
import { isValidUsername } from "@shared/profile";
import { TRPCError } from "@trpc/server";
import { createAdminProduct, deleteAdminProduct, isAdministrator, listAdminProducts, updateAdminProductPrice } from "./db";

const productInput = z.object({ productId: z.number().int().positive() });
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!isAdministrator(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to the Administrator page." });
  return next();
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  markets: router({
    products: publicProcedure.input(z.object({ query: z.string().optional(), category: z.string().optional(), limit: z.number().int().min(1).max(100).default(24) })).query(({ input }) => listProducts(input)),
    detail: publicProcedure.input(productInput).query(({ input }) => getMarket(input.productId)),
  }),
  allTrades: router({
    list: publicProcedure.query(() => listAllTrades(100)),
  }),
  trending: router({
    overview: publicProcedure.query(() => getTrendingOverview()),
  }),
  people: router({
    search: publicProcedure.input(z.object({ query: z.string().trim().min(1).max(40), exact: z.boolean().default(false) })).query(({ input }) => searchProfiles(input.query, input.exact)),
    profile: publicProcedure.input(z.object({ username: z.string().trim().min(1).max(40) })).query(({ input }) => getPublicProfile(input.username)),
  }),
  account: router({
    overview: protectedProcedure.query(({ ctx }) => getAccountOverview(ctx.user.id)),
    updateName: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(80) })).mutation(({ ctx, input }) => updateUserName(ctx.user.id, input.name)),
    updateProfile: protectedProcedure.input(z.object({ username: z.string().trim().refine(isValidUsername, "Username must be 3–40 letters, numbers, underscores, or hyphens"), isPublic: z.boolean() })).mutation(({ ctx, input }) => updateUserProfile(ctx.user.id, input)),
  }),
  admin: router({
    products: adminProcedure.query(() => listAdminProducts()),
    createProduct: adminProcedure.input(z.object({ name: z.string().trim().min(2).max(180), category: z.string().trim().min(2).max(80), description: z.string().trim().min(2).max(1000), price: z.string().trim() })).mutation(({ input }) => createAdminProduct(input)),
    updatePrice: adminProcedure.input(z.object({ productId: z.number().int().positive(), price: z.string().trim() })).mutation(({ input }) => updateAdminProductPrice(input.productId, input.price)),
    deleteProduct: adminProcedure.input(productInput).mutation(({ input }) => deleteAdminProduct(input.productId)),
  }),
  orders: router({
    create: protectedProcedure.input(z.object({ productId: z.number().int().positive(), side: z.enum(["BUY", "SELL"]), price: z.string().optional(), quantity: z.number().int().positive() })).mutation(({ ctx, input }) => placeLimitOrder({ ...input, userId: ctx.user.id })),
    cancel: protectedProcedure.input(z.object({ orderId: z.number().int().positive() })).mutation(({ ctx, input }) => cancelOrder(ctx.user.id, input.orderId)),
  }),
});

export type AppRouter = typeof appRouter;
