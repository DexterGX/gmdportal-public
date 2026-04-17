"use client";
import Navbar from "./Navbar";
import type { ProgramId } from "@/lib/programsConfig";

export default function NavbarClient({
  user,
  accessibleProgramIds,
}: {
  user: any;
  accessibleProgramIds?: ProgramId[];
}) {
  return <Navbar user={user} accessibleProgramIds={accessibleProgramIds} />;
}
