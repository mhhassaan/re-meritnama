"use client";

import { Document, Page } from "@/lib/pdf-primitives";
import { PdfcnThemeProvider } from "@/components/pdf/theme-provider";
import { Heading } from "@/components/pdf/heading/heading";
import { Text } from "@/components/pdf/text/text";
import { Stack } from "@/components/pdf/stack/stack";
import { Divider } from "@/components/pdf/divider/divider";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/pdf/table/table";
import type { Prediction } from "@/lib/predict/predict";

/**
 * The prediction report, as a PDF document.
 *
 * Mirrors the original's export field for field — the header block, the summary
 * lines, the same six columns in the same order, the same 200-row cap and the
 * same closing note. Built with `pdfcn` on the Takumi base rather than jsPDF.
 *
 * Generated entirely in the browser. The candidate's merit score is the whole
 * point of this document and it never reaches a server.
 */

/** The original truncates long hospital names to fit its fixed column. */
const HOSPITAL_MAX = 32;

const truncate = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

export type ReportContext = {
  merit: number;
  totalMarks: number;
  userPct: number;
  percentile: number;
  band: string;
  program: string;
  quota: string;
  counts: { safe: number; target: number; reach: number };
  generatedAt: string;
};

const BUCKET_ORDER = { safe: 0, target: 1, reach: 2 } as const;

export const REPORT_ROW_CAP = 200;

export function PredictionReport({
  context,
  predictions,
}: {
  context: ReportContext;
  predictions: Prediction[];
}) {
  // Grouped by bucket, then by margin — the order the original prints.
  const sorted = [...predictions].sort(
    (a, b) =>
      BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket] || b.delta - a.delta
  );
  const rows = sorted.slice(0, REPORT_ROW_CAP);

  return (
    <PdfcnThemeProvider>
      <Document>
        <Page size="A4" style={{ padding: 36 }}>
          <Heading level={1}>MeritNama — My Prediction Report</Heading>

          <Text variant="xs" color="muted">
            Generated: {context.generatedAt}
          </Text>

          <Stack gap="sm" style={{ marginTop: 14 }}>
            <Text weight="bold">
              Merit Score: {context.merit} ({context.userPct.toFixed(1)}% of
              policy max)
            </Text>
            <Text>
              Percentile: {context.percentile} · Band: {context.band}
            </Text>
            <Text>
              Program: {context.program} · Quota: {context.quota}
            </Text>
            <Text weight="bold" style={{ marginTop: 8 }}>
              Safe: {context.counts.safe} Target: {context.counts.target} Reach:{" "}
              {context.counts.reach}
            </Text>
          </Stack>

          <Divider style={{ marginTop: 14, marginBottom: 10 }} />

          <Table variant="line" zebraStripe>
            <TableHeader>
              <TableRow header>
                <TableCell width="10%">Bucket</TableCell>
                <TableCell width="26%">Specialty</TableCell>
                <TableCell width="28%">Hospital</TableCell>
                <TableCell width="20%">Quota</TableCell>
                <TableCell width="8%" align="right">
                  Avg %
                </TableCell>
                <TableCell width="8%" align="right">
                  Delta
                </TableCell>
              </TableRow>
            </TableHeader>

            <TableBody>
              {rows.map((p) => (
                <TableRow key={`${p.row.program}|${p.row.quota}|${p.row.specialty}|${p.row.hospital}`}>
                  <TableCell width="10%">{p.bucket}</TableCell>
                  <TableCell width="26%">{p.row.specialty}</TableCell>
                  <TableCell width="28%">
                    {truncate(p.row.hospital, HOSPITAL_MAX)}
                  </TableCell>
                  <TableCell width="20%">{p.row.quota || "—"}</TableCell>
                  <TableCell width="8%" align="right">
                    {p.row.avg_pct_of_max.toFixed(1)}
                  </TableCell>
                  <TableCell width="8%" align="right">
                    {p.delta >= 0 ? "+" : ""}
                    {p.delta.toFixed(1)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {sorted.length > REPORT_ROW_CAP && (
            <Text variant="xs" color="muted" style={{ marginTop: 8 }}>
              Note: showing first {REPORT_ROW_CAP} of {sorted.length} matching
              combinations.
            </Text>
          )}

          {/* Not in the original, and worth adding: a report that leaves the
              app loses the caveat that was on screen beside it. */}
          <Text variant="xs" color="muted" style={{ marginTop: 12 }}>
            Predictions compare your score against historical closing merits on
            a normalised scale. They are not a probability of getting a seat.
            Verify eligibility and official lists with PHF, PMDC and PGMI.
          </Text>
        </Page>
      </Document>
    </PdfcnThemeProvider>
  );
}
