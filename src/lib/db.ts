import { PrismaClient } from "@prisma/client";
import { GlobalValidator } from "./global-validator";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const basePrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["query"],
  });

export const db = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (
          ["create", "update", "upsert", "createMany", "updateMany"].includes(
            operation
          )
        ) {
          if (args && typeof args === "object") {
            const anyArgs = args as Record<string, any>;
            if (anyArgs.data) {
              anyArgs.data = GlobalValidator.sanitizeAndValidateDbInput(
                anyArgs.data,
                model
              );
            }
            if (anyArgs.create) {
              anyArgs.create = GlobalValidator.sanitizeAndValidateDbInput(
                anyArgs.create,
                model
              );
            }
            if (anyArgs.update) {
              anyArgs.update = GlobalValidator.sanitizeAndValidateDbInput(
                anyArgs.update,
                model
              );
            }
          }
        }
        return query(args);
      },
    },
  },
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = basePrisma;