"use server";

import { loadDirectoryRecord, type DirectoryRecord } from "./directory";

/**
 * Fetches one roster record, when a row is opened.
 *
 * The roster itself is server-rendered and sends only the table columns.
 * Preference lists, components and certificates arrive one person at a time,
 * through this — which is what keeps 50 people's preference lists out of every
 * page of the table.
 *
 * No gate is restated here. `loadDirectoryRecord` reads `pool_directory` **as
 * the caller**, so the verified-identity policy decides and an unverified
 * account gets `null`. Adding a second check would give the rule a second place
 * to drift out of agreement with the database.
 */
export async function fetchDirectoryRecord(
  applicantId: number
): Promise<DirectoryRecord | null> {
  // A non-numeric or absurd id is a bug or a probe, not a lookup. The policy
  // would refuse it anyway; failing here keeps it out of the query log.
  if (!Number.isInteger(applicantId) || applicantId <= 0) return null;

  return loadDirectoryRecord(applicantId);
}
