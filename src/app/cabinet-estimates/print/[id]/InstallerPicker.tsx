"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import RoundedSelect from "@/components/forms/RoundedSelect";

// Print-page toolbar control for the Preco de Custo view: pick which
// installer's cost to show. Re-opens the same page with ?installer=<id>.
export default function InstallerPicker({
  installers,
  value,
}: {
  installers: { id: string; name: string }[];
  value: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("installer", next);
    // Don't pop the print dialog again just because the installer changed.
    params.delete("autoprint");
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2 text-sm text-gray-700">
      <span className="font-medium">Installer</span>
      <RoundedSelect
        variant="boxed"
        className="w-40 !py-1.5"
        menuMinWidth={180}
        value={value}
        onChange={onChange}
        ariaLabel="Installer"
        placeholder="No installers"
        options={installers.map((i) => ({ value: i.id, label: i.name }))}
      />
    </div>
  );
}
