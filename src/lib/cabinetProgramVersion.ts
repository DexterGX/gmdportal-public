// Program/table version shown on Cabinet Estimates (major.minor.tables).
// See model CabinetProgramVersionLog. Self-seeds 2.1.1 on first read.

export type ProgramVersionLogRow = {
  id: string;
  major: number;
  minor: number;
  tables: number;
  kind: string;
  note: string;
  hidden: boolean;
  createdByName: string;
  createdAt: string; // ISO
  version: string;
};

export type ProgramVersionInfo = {
  // The true current version (admins see this).
  actual: string;
  // What everyone else sees - the version as of the last non-hidden update.
  public: string;
  log: ProgramVersionLogRow[]; // newest first
};

export function formatProgramVersion(v: {
  major: number;
  minor: number;
  tables: number;
}): string {
  return `${v.major}.${v.minor}.${v.tables}`;
}

function toRow(row: any): ProgramVersionLogRow {
  return {
    id: row.id,
    major: row.major,
    minor: row.minor,
    tables: row.tables,
    kind: row.kind,
    note: row.note || "",
    hidden: Boolean(row.hidden),
    createdByName: row.createdByName || "",
    createdAt: new Date(row.createdAt).toISOString(),
    version: formatProgramVersion(row),
  };
}

export async function getProgramVersion(prismaAny: any): Promise<ProgramVersionInfo> {
  let rows = await prismaAny.cabinetProgramVersionLog.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  if (rows.length === 0) {
    await prismaAny.cabinetProgramVersionLog.create({
      data: {
        major: 2,
        minor: 1,
        tables: 1,
        kind: "initial",
        note: "Initial version",
        hidden: false,
        createdByName: "System",
      },
    });
    rows = await prismaAny.cabinetProgramVersionLog.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }
  const log = rows.map(toRow);
  const actual = log[0];
  const pub = log.find((r: ProgramVersionLogRow) => !r.hidden) || actual;
  return { actual: actual.version, public: pub.version, log };
}

export type ProgramVersionBumpKind = "major" | "minor" | "tables";

// major -> (M+1).0.0, minor -> M.(m+1).0, tables -> M.m.(t+1)
export function nextProgramVersion(
  current: { major: number; minor: number; tables: number },
  kind: ProgramVersionBumpKind,
): { major: number; minor: number; tables: number } {
  if (kind === "major") return { major: current.major + 1, minor: 0, tables: 0 };
  if (kind === "minor") return { major: current.major, minor: current.minor + 1, tables: 0 };
  return { major: current.major, minor: current.minor, tables: current.tables + 1 };
}
