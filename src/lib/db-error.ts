const MIGRATION_FILE = "supabase/migrations/20260922100000_admin_inquiries_documents.sql";

type DbError = { code?: string | undefined; message: string };

/**
 * Turns a Postgres error into something a human can act on.
 *
 * The one worth special-casing is 42P01 (undefined_table). Until the admin
 * migration has been applied to the Supabase project, every dashboard query
 * fails with it, and the raw text ("relation ... does not exist") reads like an
 * application bug rather than a setup step that has not happened yet.
 */
export function describeDbError(error: DbError): string {
  if (error.code === "42P01") {
    return `The admin tables do not exist yet. Apply ${MIGRATION_FILE} to your Supabase project, then reload.`;
  }
  if (error.code === "42883") {
    return `A database function is missing. Apply ${MIGRATION_FILE} to your Supabase project, then reload.`;
  }
  return error.message;
}
