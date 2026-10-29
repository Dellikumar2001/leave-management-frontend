import type { PrismaClient as PrismaClientType } from "@prisma/client";
import path from "path";

const CLIENT_VERSION = "2026-10-29-leave-year-end-process-v5";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClientType;
  prismaVersion?: string;
};

function getFreshPrismaClient(): PrismaClientType {
  try {
    const nodeRequire = eval("require");
    const clientPath = path.resolve(process.cwd(), "node_modules/.prisma/client");
    const pkgPath = path.resolve(process.cwd(), "node_modules/@prisma/client");

    if (nodeRequire.cache) {
      Object.keys(nodeRequire.cache).forEach((k) => {
        if (k.includes(".prisma") || k.includes("@prisma")) {
          delete nodeRequire.cache[k];
        }
      });
    }

    const { PrismaClient } = nodeRequire(pkgPath);
    const client = new PrismaClient({
      log: ["query", "error", "warn"],
    });

    console.log("[lib/prisma.ts] Instantiated fresh PrismaClient from disk. leaveYearEndProcess available:", !!client.leaveYearEndProcess);
    return client;
  } catch (err) {
    console.error("[lib/prisma.ts] Failed to dynamically load PrismaClient:", err);
    // Fallback to static
    const { PrismaClient } = require("@prisma/client");
    return new PrismaClient({
      log: ["query", "error", "warn"],
    });
  }
}

const isStale =
  !globalForPrisma.prisma ||
  globalForPrisma.prismaVersion !== CLIENT_VERSION ||
  !("paternityLeave" in globalForPrisma.prisma) ||
  !("maternityLeave" in globalForPrisma.prisma) ||
  !("employeeLeaveApplication" in globalForPrisma.prisma) ||
  !("employeeApprover" in globalForPrisma.prisma) ||
  !("leaveEligibility" in globalForPrisma.prisma) ||
  !("leaveYearEndProcess" in globalForPrisma.prisma) ||
  !("leaveYearEndRecord" in globalForPrisma.prisma) ||
  !("employeeCycleBalance" in globalForPrisma.prisma) ||
  !("employeeLeaveUsage" in globalForPrisma.prisma) ||
  !("employeeLeaveApproval" in globalForPrisma.prisma);

export const prisma =
  !isStale && globalForPrisma.prisma
    ? globalForPrisma.prisma
    : getFreshPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaVersion = CLIENT_VERSION;
}
