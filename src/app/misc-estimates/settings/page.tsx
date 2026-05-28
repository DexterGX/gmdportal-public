import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import MiscLedSettingsClient from "./MiscLedSettingsClient";

const prismaAny = prisma as any;

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default async function MiscLedSettingsPage() {
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  if (!user || !isActive || appRole === "unassigned") {
    redirect("/login");
  }

  if (appRole !== "admin") {
    redirect("/misc-estimates");
  }

  const [rooms, ledTypes, controlTypes, profiles] = await Promise.all([
    prismaAny.miscLedRoom.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prismaAny.miscLedType.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prismaAny.miscLedControlType.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prismaAny.miscLedProfile.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  return (
    <MiscLedSettingsClient
      initialRooms={rooms}
      initialLedTypes={ledTypes.map((item: any) => ({
        ...item,
        minimumPriceUnder25Ft: toNumber(item.minimumPriceUnder25Ft),
        pricePerFt: toNumber(item.pricePerFt),
      }))}
      initialControlTypes={controlTypes.map((item: any) => ({
        ...item,
        unitPrice: toNumber(item.unitPrice),
      }))}
      initialProfiles={profiles.map((item: any) => ({
        ...item,
        unitPrice: toNumber(item.unitPrice),
        groovePricePerFt: toNumber(item.groovePricePerFt),
      }))}
    />
  );
}
