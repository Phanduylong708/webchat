import pkg from "@prisma/client";
const { PrismaClient } = pkg;

/**
 * @type {import('@prisma/client').PrismaClient}
 */
export const prisma = globalThis.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;
