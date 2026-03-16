import { notFound } from "next/navigation";
import SlabLabelClient from "../[slabId]/SlabLabelClient";

export default async function SlabLabelPreviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const get = (key: string) => {
    const v = sp[key];
    return typeof v === "string" ? v : "";
  };

  const scannerId = get("scannerId");
  if (!scannerId) notFound();

  return (
    <SlabLabelClient
      slab={{
        id: scannerId,
        scannerId,
        name: get("name"),
        type: get("type"),
        thickness: get("thickness"),
        size: get("size"),
        clientName: get("clientName"),
        brand: get("brand"),
        finish: get("finish"),
        notes: get("notes"),
        jobId: get("jobId"),
        rackId: get("rackId"),
      }}
    />
  );
}
