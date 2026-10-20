"use client";

import InlineList, { ListColumn } from "./InlineList";
import { Modal, Notify } from "./parametersUi";

export type InstallerRow = {
  id: string;
  name: string;
  company: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  sortOrder: number;
};

const COLUMNS: ListColumn[] = [
  { key: "name", label: "Name", kind: "text", className: "min-w-[160px]" },
  { key: "company", label: "Company", kind: "text", className: "min-w-[150px]" },
  { key: "phone", label: "Phone", kind: "text", className: "min-w-[130px]" },
  { key: "email", label: "Email", kind: "text", className: "min-w-[180px]" },
  { key: "address", label: "Address", kind: "text", className: "min-w-[200px]" },
];

export default function InstallersManager({
  installers,
  onChange,
  onClose,
  notify,
}: {
  installers: InstallerRow[];
  onChange: (updater: (prev: InstallerRow[]) => InstallerRow[]) => void;
  onClose: () => void;
  notify: Notify;
}) {
  return (
    <Modal
      wide
      title="Installers"
      description="Each active installer gets its own cost column in the price table. Switch an installer off to hide the column without losing its costs."
      onClose={onClose}
    >
      <InlineList<InstallerRow>
        entityLabel="installer"
        rows={installers}
        onRowsChange={onChange}
        columns={COLUMNS}
        collectionUrl="/api/cabinet-estimates/parameters/installers"
        itemUrl={(id) => `/api/cabinet-estimates/parameters/installers/${id}`}
        rowLabel={(r) => r.name}
        buildPayload={(v) => {
          const name = v.name.trim();
          if (!name) return { error: "Installer name is required." };
          return {
            payload: {
              name,
              company: v.company.trim(),
              phone: v.phone.trim(),
              email: v.email.trim(),
              address: v.address.trim(),
            },
          };
        }}
        deleteWarning="Deleting an installer also deletes all of their saved costs."
        emptyText="No installers yet - type a name in the top row and press Enter."
        notify={notify}
      />
    </Modal>
  );
}
