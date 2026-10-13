import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

const isStale =
  !globalForPrisma.prisma ||
  !("paternityLeave" in globalForPrisma.prisma) ||
  !("maternityLeave" in globalForPrisma.prisma);

export const prisma =
  !isStale && globalForPrisma.prisma
    ? globalForPrisma.prisma
    : new PrismaClient({
        log: ["query", "error", "warn"],
      });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
