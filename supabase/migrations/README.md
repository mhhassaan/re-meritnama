# Migrations

These files are the schema history, and as of 2026-08-19 they are **complete**:
all 17 migrations applied to the database exist here.

## What went wrong before, so it does not recur

Migrations applied through the Supabase MCP tool are recorded in the database's
own `supabase_migrations.schema_migrations` table, but **no file is written
here**. Eight of the seventeen had been applied that way and existed only in the
database.

That is not a tidiness problem. A fresh project built from this directory alone
would have come up:

- without `merit_entries_require_verified_identity`, so gazette data would have
  been readable by any signed-in account rather than a verified one — the exact
  exposure this rebuild exists to close;
- without the composite `(induction, applicant_id)` identity, so loading a
  second cycle would have collided or silently overwritten a different person's
  record;
- with `payment-proofs` as a public bucket, exposing bank-transfer screenshots.

The database was correct throughout. The reproducible definition of it was not,
and the gap was invisible because everything worked against the live project.

## The rule

**Anything applied through MCP gets a file here in the same turn.** Copy the
statements verbatim; do not paraphrase them, and do not let a file drift from
what was actually run.

## Checking

    supabase migration list

compares local against remote. Without the CLI logged in, the same answer comes
from:

```sql
select version, name from supabase_migrations.schema_migrations order by version;
```

Compare that against `ls supabase/migrations/`. The two lists must match exactly.
