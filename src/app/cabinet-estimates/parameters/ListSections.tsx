"use client";

import { useState } from "react";
import InlineList, { ListColumn } from "./InlineList";
import type {
  DiscountOption,
  InstallationType,
  ProjectType,
  RemovalType,
  SpecialCustomizationItem,
} from "./parameterTypes";
import { Notify, SectionCard, parseNumber } from "./parametersUi";

const BASE = "/api/cabinet-estimates/parameters";

/* ---------------------------- Installation Types ---------------------------- */

const TYPE_COLUMNS: ListColumn[] = [
  { key: "name", label: "Name", kind: "text", className: "min-w-[140px]" },
  { key: "multiplier", label: "Multiplier", kind: "multiplier", className: "w-28", placeholder: "1" },
  {
    key: "description",
    label: "Explanation",
    kind: "textarea",
    className: "min-w-[240px]",
    placeholder: "Shown in the info pop-up next to Installation on the estimate",
  },
];

export function InstallationTypesCard({
  initial,
  notify,
}: {
  initial: InstallationType[];
  notify: Notify;
}) {
  const [rows, setRows] = useState<InstallationType[]>(initial);
  return (
    <SectionCard
      title="Installation Types"
      description="The Standard / Special / Custom choice on the estimate form. Each one multiplies the Base Installation."
    >
      <InlineList<InstallationType>
        entityLabel="installation type"
        rows={rows}
        onRowsChange={setRows}
        columns={TYPE_COLUMNS}
        newDefaults={{ multiplier: "1" }}
        collectionUrl={`${BASE}/installation-types`}
        itemUrl={(id) => `${BASE}/installation-types/${id}`}
        rowLabel={(r) => r.name}
        normalizeRow={(j) => ({ ...j, multiplier: parseNumber(j.multiplier), description: j.description ?? "" })}
        buildPayload={(v) => {
          const name = v.name.trim();
          if (!name) return { error: "Name is required." };
          return {
            payload: { name, multiplier: parseNumber(v.multiplier), description: v.description.trim() },
          };
        }}
        deleteWarning="Types already used on a saved estimate can't be deleted."
        emptyText="No installation types yet."
        notify={notify}
      />
    </SectionCard>
  );
}

/* ----------------------------- Special customization ----------------------------- */

const SC_COLUMNS: ListColumn[] = [
  { key: "name", label: "Name", kind: "text", className: "min-w-[200px]", placeholder: "e.g. Island Back Panel" },
  { key: "price", label: "Price", kind: "money", className: "w-32", placeholder: "0.00" },
  { key: "sortOrder", label: "Order", kind: "int", className: "w-20", hint: "Lower numbers show first on the estimate form" },
];

export function SpecialCustomizationCard({
  initial,
  notify,
}: {
  initial: SpecialCustomizationItem[];
  notify: Notify;
}) {
  const [rows, setRows] = useState<SpecialCustomizationItem[]>(initial);
  return (
    <SectionCard
      title="Special Customization Items"
      description="The customization types and prices offered in the Cabinet Estimate form's Special Customization sidebar. Switch an item off instead of deleting it if it has already been used on a saved estimate."
    >
      <InlineList<SpecialCustomizationItem>
        entityLabel="customization"
        rows={rows}
        onRowsChange={setRows}
        columns={SC_COLUMNS}
        collectionUrl="/api/cabinet-estimates/special-customization-items"
        itemUrl={(id) => `/api/cabinet-estimates/special-customization-items/${id}`}
        rowLabel={(r) => r.name}
        sortRows={(a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)}
        normalizeRow={(j) => ({ ...j, price: parseNumber(j.price), sortOrder: parseNumber(j.sortOrder) })}
        buildPayload={(v, mode) => {
          const name = v.name.trim();
          if (!name) return { error: "Name is required." };
          const payload: Record<string, unknown> = { name, price: parseNumber(v.price) };
          if (mode === "update") payload.sortOrder = Math.trunc(parseNumber(v.sortOrder));
          return { payload };
        }}
        deleteWarning="If it was used on a saved estimate, switch it off instead."
        emptyText="No customization types yet - type a name and price in the top row."
        notify={notify}
      />
    </SectionCard>
  );
}

/* --------------------------------- Discounts --------------------------------- */

const DISCOUNT_COLUMNS: ListColumn[] = [
  { key: "percent", label: "Percent", kind: "percent", className: "w-28", placeholder: "10" },
  {
    key: "label",
    label: "Shown as (optional)",
    kind: "text",
    className: "min-w-[160px]",
    placeholder: "e.g. Contractor",
    hint: "A word to show in the dropdown instead of the percent",
  },
];

export function DiscountsCard({ initial, notify }: { initial: DiscountOption[]; notify: Notify }) {
  const [rows, setRows] = useState<DiscountOption[]>(initial);
  return (
    <SectionCard
      title="Discounts"
      description="Choices for the Discount dropdown in the estimate's Total Summary, each a percent of the Cabinets total. Saved estimates keep the discount they were billed at; switch an option off to hide it from new estimates."
    >
      <InlineList<DiscountOption>
        entityLabel="discount"
        rows={rows}
        onRowsChange={setRows}
        columns={DISCOUNT_COLUMNS}
        collectionUrl={`${BASE}/discount-options`}
        itemUrl={(id) => `${BASE}/discount-options/${id}`}
        rowLabel={(r) => r.label.trim() || `${r.percent}%`}
        sortRows={(a, b) => a.sortOrder - b.sortOrder || a.percent - b.percent}
        normalizeRow={(j) => ({ ...j, percent: parseNumber(j.percent), label: j.label ?? "" })}
        buildPayload={(v) => {
          const percent = Math.trunc(parseNumber(v.percent));
          if (percent < 0 || percent > 100) return { error: "Percent must be between 0 and 100." };
          return { payload: { percent, label: v.label.trim() } };
        }}
        emptyText="No discounts yet - type a percent in the top row."
        notify={notify}
      />
    </SectionCard>
  );
}

/* ------------------------------- Removal types ------------------------------- */

const REMOVAL_COLUMNS: ListColumn[] = [
  { key: "name", label: "Name", kind: "text", className: "min-w-[160px]" },
  { key: "percent", label: "% of Cabinets", kind: "percent", className: "w-32", placeholder: "0" },
];

export function RemovalTypesCard({ initial, notify }: { initial: RemovalType[]; notify: Notify }) {
  const [rows, setRows] = useState<RemovalType[]>(initial);
  return (
    <SectionCard
      title="Removal Types"
      description="The Removal dropdown in the estimate header. The percent is taken from the pre-discount Cabinets total and fills in the Removal amount automatically."
    >
      <InlineList<RemovalType>
        entityLabel="removal type"
        rows={rows}
        onRowsChange={setRows}
        columns={REMOVAL_COLUMNS}
        collectionUrl={`${BASE}/removal-types`}
        itemUrl={(id) => `${BASE}/removal-types/${id}`}
        rowLabel={(r) => r.name}
        normalizeRow={(j) => ({ ...j, percent: parseNumber(j.percent) })}
        buildPayload={(v) => {
          const name = v.name.trim();
          if (!name) return { error: "Name is required." };
          return { payload: { name, percent: parseNumber(v.percent) } };
        }}
        deleteWarning="Types already used on a saved estimate can't be deleted."
        emptyText="No removal types yet."
        notify={notify}
      />
    </SectionCard>
  );
}

/* ------------------------------- Project types ------------------------------- */

const PROJECT_COLUMNS: ListColumn[] = [{ key: "name", label: "Name", kind: "text", className: "min-w-[200px]" }];

export function ProjectTypesCard({ initial, notify }: { initial: ProjectType[]; notify: Notify }) {
  const [rows, setRows] = useState<ProjectType[]>(initial);
  return (
    <SectionCard
      title="Project Types"
      description="The Project Type dropdown in the estimate header - just a list of names for now."
    >
      <InlineList<ProjectType>
        entityLabel="project type"
        rows={rows}
        onRowsChange={setRows}
        columns={PROJECT_COLUMNS}
        collectionUrl={`${BASE}/project-types`}
        itemUrl={(id) => `${BASE}/project-types/${id}`}
        rowLabel={(r) => r.name}
        buildPayload={(v) => {
          const name = v.name.trim();
          if (!name) return { error: "Name is required." };
          return { payload: { name } };
        }}
        deleteWarning="Types already used on a saved estimate can't be deleted."
        emptyText="No project types yet."
        notify={notify}
      />
    </SectionCard>
  );
}
