import { PrismaClient } from "@prisma/client";
import { GlobalValidator } from "./global-validator";

/**
 * Ensures DATABASE_URL has a capped connection limit and pool timeout to prevent
 * exhausting PostgreSQL connections under heavy traffic or serverless re-use.
 */
export function getCappedDatabaseUrl(
  urlStr?: string,
  maxConnections?: string
): string | undefined {
  const targetUrl = urlStr !== undefined ? urlStr : process.env.DATABASE_URL;
  if (!targetUrl) return undefined;
  const limit = maxConnections || process.env.DB_MAX_CONNECTIONS || "10";
  try {
    const parsed = new URL(targetUrl);
    if (!parsed.searchParams.has("connection_limit")) {
      parsed.searchParams.set("connection_limit", limit);
    }
    if (!parsed.searchParams.has("pool_timeout")) {
      parsed.searchParams.set("pool_timeout", "30");
    }
    return parsed.toString();
  } catch {
    return targetUrl;
  }
}

function createPrismaClient() {
  const cappedUrl = getCappedDatabaseUrl();
  const basePrisma = new PrismaClient({
    ...(cappedUrl ? { datasources: { db: { url: cappedUrl } } } : {}),
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

  return basePrisma.$extends({
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
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForDb = globalThis as unknown as {
  prismaExtendedClient: ExtendedPrismaClient | undefined;
  prisma: ExtendedPrismaClient | undefined;
};

// Global singleton instance shared across all API routes, server actions, and module re-evaluations
export const db: ExtendedPrismaClient =
  globalForDb.prismaExtendedClient ??
  globalForDb.prisma ??
  createPrismaClient();

// Always attach to globalThis in both development (HMR) and production (chunk deduplication)
if (!globalForDb.prismaExtendedClient) {
  globalForDb.prismaExtendedClient = db;
}
if (!globalForDb.prisma) {
  globalForDb.prisma = db;
}
