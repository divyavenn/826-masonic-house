import {
  listApplications,
  activity,
  type Application,
} from "../../../../lib/store";
import { authorize, fail } from "../../../../lib/http";
import { filters } from "../../../../lib/filters";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  try {
    authorize(request);
    const filter = filters(request);
    const applications: Application[] = [];
    let offset = 0;
    while (true) {
      const page = listApplications({ ...filter, offset, limit: 100 });
      applications.push(...page.applications);
      if (page.nextOffset === null) break;
      offset = page.nextOffset;
    }
    const fields = [
      "id",
      "createdAt",
      "updatedAt",
      "name",
      "phone",
      "room",
      "stayType",
      "moveIn",
      "moveOut",
      "notes",
      "status",
      "internalNotes",
      "metadata",
    ];
    const quote = (value: unknown) => {
      let text = String(value ?? "");
      if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
      return '"' + text.replaceAll('"', '""') + '"';
    };
    const rows = applications.map((application) => ({
      ...application,
      metadata: JSON.stringify(application.metadata),
      internalNotes: activity(application.id)
        .filter((e) => e.note)
        .map((e) => `${e.createdAt} (${e.actor}): ${e.note}`)
        .join("\n"),
    }));
    const csv =
      "\uFEFF" +
      [
        fields,
        ...rows.map((row) =>
          fields.map((field) => row[field as keyof typeof row]),
        ),
      ]
        .map((row) => row.map(quote).join(","))
        .join("\r\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="house-applications.csv"',
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return fail(error);
  }
}
