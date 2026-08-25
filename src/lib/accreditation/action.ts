"use server";

import {
  loadAccreditation,
  type AccreditationFilters,
  type AccreditationRow,
} from "./data";

/**
 * The next batch of accredited programmes.
 *
 * The page renders the first batch and the client appends the rest. Sending all
 * 5,587 rows up front and revealing them in the browser would move the cost
 * rather than remove it — the hospital names alone are most of the 849 KB file.
 *
 * No gate. Unlike every other action in this codebase, the data behind this one
 * is institutional: a hospital, a city, a speciality and a date, already
 * published by CPSP and already sitting in `public/data/`. There is nothing
 * here that a policy would be protecting.
 */
export type MoreProgramsRequest = Omit<AccreditationFilters, "page"> & {
  page: number;
};

export type MoreProgramsResult = {
  rows: AccreditationRow[];
  page: number;
  pageCount: number;
};

export async function moreAccreditedPrograms(
  request: MoreProgramsRequest
): Promise<MoreProgramsResult> {
  const view = await loadAccreditation(request);
  return { rows: view.rows, page: view.page, pageCount: view.pageCount };
}
