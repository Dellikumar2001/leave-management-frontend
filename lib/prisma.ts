import { PrismaClient } from "@prisma/client";

const CLIENT_VERSION = "2026-10-14-applications";
const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
  prismaVersion?: string;
};

const isStale =
  !globalForPrisma.prisma ||
  globalForPrisma.prismaVersion !== CLIENT_VERSION ||
  !("paternityLeave" in globalForPrisma.prisma) ||
  !("maternityLeave" in globalForPrisma.prisma) ||
  !("employeeLeaveApplication" in globalForPrisma.prisma);

export const prisma =
  !isStale && globalForPrisma.prisma
    ? globalForPrisma.prisma
    : new PrismaClient({
        log: ["query", "error", "warn"],
      });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaVersion = CLIENT_VERSION;
}
