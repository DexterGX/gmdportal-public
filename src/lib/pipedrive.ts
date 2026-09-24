/**
 * Pipedrive API v2 Integration
 *
 * Syncs deals, persons and organizations from Pipedrive.
 *
 * Key behaviours:
 * - A Pipedrive Person → Customer (type = CLIENT)
 * - A Pipedrive Organization → Customer (type = CONTRACTOR, pipedriveId = "org_<id>")
 * - When a person belongs to an org, referredByOrgPipedriveId / referredByOrgName
 *   are set on the CLIENT record so the relationship is preserved without changing type.
 * - Each Pipedrive Deal → Job with rich detail fields (type, QB URL, CompanyCam, address…)
 *
 * Environment variables required:
 *   PIPEDRIVE_API_TOKEN
 *   PIPEDRIVE_COMPANY_DOMAIN  (e.g. "gmdesign")
 */

import { prisma } from "./prisma";
import { CustomerType } from "@prisma/client";

const PIPEDRIVE_API_VERSION = "v2";
const PIPEDRIVE_USERS_API_VERSION = "v1";

interface PipedriveConfig {
  apiToken: string;
  companyDomain: string;
}

/**
 * Get Pipedrive configuration from environment variables.
 */
function getConfig(): PipedriveConfig {
  const apiToken = process.env.PIPEDRIVE_API_TOKEN;
  const companyDomain = process.env.PIPEDRIVE_COMPANY_DOMAIN;

  if (!apiToken || !companyDomain) {
    throw new Error(
      "Missing Pipedrive configuration. Set PIPEDRIVE_API_TOKEN and PIPEDRIVE_COMPANY_DOMAIN.",
    );
  }

  return { apiToken, companyDomain };
}

/**
 * Get Pipedrive API v2 base URL.
 */
function getApiBase(): string {
  const { companyDomain } = getConfig();
  return `https://${companyDomain}.pipedrive.com/api/${PIPEDRIVE_API_VERSION}`;
}

function getUsersApiBase(): string {
  const { companyDomain } = getConfig();
  return `https://${companyDomain}.pipedrive.com/api/${PIPEDRIVE_USERS_API_VERSION}`;
}

/**
 * Make an authenticated request to Pipedrive API v2.
 */
async function pipedriveRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const { apiToken } = getConfig();
  const baseUrl = getApiBase();

  const url = new URL(`${baseUrl}${endpoint}`);
  url.searchParams.set("api_token", apiToken);

  const response = await fetch(url.toString(), {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const contentType = response.headers.get("content-type") || "";

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Pipedrive API error (${response.status}): ${error}`);
  }

  if (!contentType.toLowerCase().includes("application/json")) {
    const body = await response.text();
    const preview = body.slice(0, 240);
    throw new Error(
      `Pipedrive API returned non-JSON response (content-type: ${contentType || "unknown"}). Body preview: ${preview}`,
    );
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(`Pipedrive API error: ${data.error || "Unknown error"}`);
  }

  return data;
}

async function pipedriveUsersRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const { apiToken } = getConfig();
  const baseUrl = getUsersApiBase();

  const url = new URL(`${baseUrl}${endpoint}`);
  url.searchParams.set("api_token", apiToken);

  const response = await fetch(url.toString(), {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const contentType = response.headers.get("content-type") || "";

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Pipedrive API error (${response.status}): ${error}`);
  }

  if (!contentType.toLowerCase().includes("application/json")) {
    const body = await response.text();
    const preview = body.slice(0, 240);
    throw new Error(
      `Pipedrive users API returned non-JSON response (content-type: ${contentType || "unknown"}). Body preview: ${preview}`,
    );
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(`Pipedrive API error: ${data.error || "Unknown error"}`);
  }

  return data;
}

/**
 * Pipedrive Deal — v2 shape.
 * person_id and org_id are plain numbers (not nested objects).
 */
export interface PipedriveDeal {
  id: number;
  title: string;
  value: number;
  currency: string;
  status: string; // "open" | "won" | "lost" | "deleted"
  stage_id: number;
  pipeline_id?: number;
  person_id: number | null;
  org_id: number | null;
  creator_user_id?: number | null;
  owner_id?: number | null;
  add_time: string;
  update_time: string;
  close_time?: string | null;
  won_time?: string | null;
  lost_time?: string | null;
  expected_close_date?: string | null;
  /** Custom fields keyed by hash */
  custom_fields?: Record<string, any>;
}

/**
 * Pipedrive Person — v2 shape.
 */
export interface PipedrivePerson {
  id: number;
  name: string;
  first_name?: string;
  last_name?: string;
  /** v2 field name */
  emails?: Array<{ value: string; primary: boolean; label?: string }>;
  /** v1 fallback field name */
  email?: Array<{ value: string; primary: boolean; label?: string }>;
  /** v2 field name */
  phones?: Array<{ value: string; primary: boolean; label?: string }>;
  /** v1 fallback field name */
  phone?: Array<{ value: string; primary: boolean; label?: string }>;
  org_id?: number | null;
  owner_id?: number | null;
  add_time?: string;
  update_time?: string;
  active_flag?: boolean;
  custom_fields?: Record<string, any>;
}

/**
 * Pipedrive Organization — v2 shape.
 */
export interface PipedriveOrganization {
  id: number;
  name: string;
  address?: {
    value?: string;
    formatted_address?: string;
    street_number?: string;
    route?: string;
    sublocality?: string;
    locality?: string;
    admin_area_level_1?: string;
    admin_area_level_2?: string;
    country?: string;
    postal_code?: string;
  } | null;
  owner_id?: number | null;
  custom_fields?: Record<string, any>;
}

// ---------------------------------------------------------------------------
// Known custom field keys for this account
// ---------------------------------------------------------------------------

/** Deal custom field hashes */
export const DEAL_FIELDS = {
  ADDRESS: "b91459b6b4eceb9a2cfeba8ee74e8f7c0404b0c3",
  JOB_TYPE: "5c6630f4269b882982e009612f54d3f8df41b3ac",
  QB_URL: "f4b7116c419c71096d14238730d36e67a9bc74d0",
  QB_ID: "c130b9af766767050e8889211d87ed00f460e5dd",
  CC_ID: "0e421ad1de6e38926f88e6f8a8402a8f72ad141e",
  CC_URL: "dad64e0237ea11f6a866eb8d42f6a0e0679c1a42",
} as const;

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

interface PipedriveV2ListResponse<T> {
  success: boolean;
  data: T[] | null;
  additional_data?: { next_cursor?: string | null; total_count?: number };
}

// ---------------------------------------------------------------------------
// Fetch functions
// ---------------------------------------------------------------------------

/**
 * Fetch all deals from Pipedrive using cursor-based pagination (v2).
 */
async function fetchDealsByStatus(
  status: "open" | "won" | "lost" | "deleted",
): Promise<PipedriveDeal[]> {
  const allDeals: PipedriveDeal[] = [];
  let cursor: string | null = null;
  const limit = 100;

  while (true) {
    const params = new URLSearchParams({ limit: limit.toString(), status });
    if (cursor) params.set("cursor", cursor);

    const response = await pipedriveRequest<
      PipedriveV2ListResponse<PipedriveDeal>
    >(`/deals?${params.toString()}`);

    if (response.data?.length) allDeals.push(...response.data);

    const nextCursor = response.additional_data?.next_cursor;
    if (!nextCursor) break;
    cursor = nextCursor;
  }

  return allDeals;
}

export async function fetchAllDeals(
  status:
    | "all_not_deleted"
    | "open"
    | "won"
    | "lost"
    | "deleted" = "all_not_deleted",
): Promise<PipedriveDeal[]> {
  if (status !== "all_not_deleted") {
    return fetchDealsByStatus(status);
  }

  // Pipedrive API v2 does not accept status=all_not_deleted; fetch non-deleted
  // buckets explicitly and merge by deal id.
  const [openDeals, wonDeals, lostDeals] = await Promise.all([
    fetchDealsByStatus("open"),
    fetchDealsByStatus("won"),
    fetchDealsByStatus("lost"),
  ]);

  const mergedById = new Map<number, PipedriveDeal>();
  for (const deal of [...openDeals, ...wonDeals, ...lostDeals]) {
    mergedById.set(deal.id, deal);
  }

  return Array.from(mergedById.values());
}

/**
 * Fetch a single deal by ID (v2). Used by the webhook so custom fields are
 * always read in the v2 API shape, whatever the webhook payload looks like.
 */
export async function fetchDeal(dealId: number): Promise<PipedriveDeal | null> {
  try {
    const response = await pipedriveRequest<{
      success: boolean;
      data: PipedriveDeal;
    }>(`/deals/${dealId}`);
    return response.data;
  } catch (error) {
    console.error(`[Pipedrive] Failed to fetch deal ${dealId}:`, error);
    return null;
  }
}

/**
 * Fetch a single person by ID (v2).
 */
export async function fetchPerson(
  personId: number,
): Promise<PipedrivePerson | null> {
  try {
    const response = await pipedriveRequest<{
      success: boolean;
      data: PipedrivePerson;
    }>(`/persons/${personId}`);
    return response.data;
  } catch (error) {
    console.error(`[Pipedrive] Failed to fetch person ${personId}:`, error);
    return null;
  }
}

/**
 * Fetch a single organization by ID, including custom_fields (v2).
 */
export async function fetchOrganization(
  orgId: number,
): Promise<PipedriveOrganization | null> {
  try {
    const response = await pipedriveRequest<{
      success: boolean;
      data: PipedriveOrganization;
    }>(`/organizations/${orgId}`);
    return response.data;
  } catch (error) {
    console.error(`[Pipedrive] Failed to fetch organization ${orgId}:`, error);
    return null;
  }
}

/**
 * Fetch a Pipedrive user by ID (for sales person / owner resolution).
 */
export async function fetchUser(
  userId: number,
): Promise<{ id: number; name: string; email: string } | null> {
  try {
    const response = await pipedriveUsersRequest<{
      success: boolean;
      data: { id: number; name: string; email: string };
    }>(`/users/${userId}`);
    return response.data;
  } catch (error) {
    console.error(`[Pipedrive] Failed to fetch user ${userId}:`, error);
    return null;
  }
}

/**
 * Extract primary email from v1 (email[]) or v2 (emails[]) array.
 */
export function getPrimaryEmail(
  emails?: Array<{ value: string; primary: boolean; label?: string }>,
): string | undefined {
  if (!emails || emails.length === 0) return undefined;
  const primary = emails.find((e) => e.primary);
  return primary?.value || emails[0]?.value;
}

/**
 * Extract primary phone from v1 (phone[]) or v2 (phones[]) array.
 */
export function getPrimaryPhone(
  phones?: Array<{ value: string; primary: boolean; label?: string }>,
): string | undefined {
  if (!phones || phones.length === 0) return undefined;
  const primary = phones.find((p) => p.primary);
  return primary?.value || phones[0]?.value;
}

/**
 * Convert a Pipedrive address object to a QB-style billAddr JSON blob.
 */
export function buildBillAddr(
  addrField: Record<string, any> | null | undefined,
): Record<string, string> | null {
  if (!addrField?.formatted_address) return null;
  return {
    Line1:
      addrField.street_number && addrField.route
        ? `${addrField.street_number} ${addrField.route}`
        : addrField.route || "",
    City: addrField.locality || "",
    CountrySubDivisionCode: addrField.admin_area_level_1 || "",
    PostalCode: addrField.postal_code || "",
    Country: addrField.country || "United States",
  };
}

// ---------------------------------------------------------------------------
// Mapping functions
// ---------------------------------------------------------------------------

/**
 * Map a Pipedrive Person (+ optional enrichment data) to a Customer DB record.
 *
 * Type rules:
 *  - Person with or without org → CLIENT
 *  - When org is present: referredByOrgPipedriveId / referredByOrgName are set
 *    so sales can see "referred by Beyond Closets" without losing the CLIENT type.
 *  - Organizations are tracked separately as CONTRACTOR records.
 */
export function mapPipedrivePersonToCustomer(
  person: PipedrivePerson,
  orgData?: PipedriveOrganization | null,
  ownerName?: string,
) {
  const email = getPrimaryEmail(person.emails || person.email);
  const phone = getPrimaryPhone(person.phones || person.phone);
  const companyName = orgData?.name;
  return {
    pipedriveId: person.id.toString(),
    type: CustomerType.CLIENT,
    displayName: person.name,
    companyName: companyName || undefined,
    givenName: person.first_name,
    familyName: person.last_name,
    email: email || undefined,
    phone: phone || undefined,
    salesPerson: ownerName || undefined,
    referredByOrgPipedriveId: orgData ? orgData.id.toString() : undefined,
    referredByOrgName: orgData?.name || undefined,
    pipedriveData: person as any,
    active: person.active_flag ?? true,
  };
}

/**
 * Map a Pipedrive Organization to a Customer DB record (type = CONTRACTOR).
 * pipedriveId is prefixed with "org_" to avoid collisions with person IDs.
 */
export function mapPipedriveOrgToCustomer(
  org: PipedriveOrganization,
  ownerName?: string,
) {
  const addrField = typeof org.address === "object" ? org.address : null;
  const billAddr = buildBillAddr(addrField);
  const cf = org.custom_fields || {};
  const qbId = cf["4e3f199ddb1d628f6e416a70cbe5b774e9e2196d"]
    ? String(cf["4e3f199ddb1d628f6e416a70cbe5b774e9e2196d"])
    : undefined;

  return {
    pipedriveId: `org_${org.id}`,
    type: CustomerType.CONTRACTOR,
    displayName: org.name,
    companyName: org.name,
    salesPerson: ownerName || undefined,
    billAddr: billAddr || undefined,
    shipAddr: billAddr || undefined,
    quickbooksId: qbId,
    pipedriveData: org as any,
    active: true,
  };
}

/**
 * Reads a text-like custom field value. Pipedrive sends these either as a
 * plain value (API v2) or wrapped as { type, value } (webhooks v2).
 * Never returns "[object Object]".
 */
export function readCustomFieldText(raw: unknown): string | null {
  let v: unknown = raw;
  if (v && typeof v === "object" && "value" in (v as Record<string, unknown>)) {
    v = (v as Record<string, unknown>).value;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "string") {
    const trimmed = v.trim();
    return trimmed ? trimmed : null;
  }
  return null;
}

/**
 * Map a Pipedrive Deal to a Job DB record.
 * Extracts all known custom field values (address, type, QB URL, CompanyCam…).
 */
export function mapPipedriveDealToJob(deal: PipedriveDeal, customerId: string) {
  const cf = deal.custom_fields || {};

  const addrField = cf[DEAL_FIELDS.ADDRESS];
  const propertyAddress = addrField?.formatted_address || null;

  const jobType = readCustomFieldText(cf[DEAL_FIELDS.JOB_TYPE]);
  const quickbooksUrl = readCustomFieldText(cf[DEAL_FIELDS.QB_URL]);
  const companyCamId = readCustomFieldText(cf[DEAL_FIELDS.CC_ID]);
  const companyCamUrl = readCustomFieldText(cf[DEAL_FIELDS.CC_URL]);

  const wonOrClose = deal.won_time || deal.close_time;
  const closeDate = wonOrClose ? new Date(wonOrClose) : null;
  const expectedCloseDate = deal.expected_close_date
    ? new Date(deal.expected_close_date)
    : null;

  const status =
    deal.status === "won"
      ? "COMPLETE"
      : deal.status === "lost"
        ? "CANCELLED"
        : "ONGOING";

  return {
    pipedriveId: deal.id.toString(),
    customerId,
    jobName: deal.title,
    dealTitle: deal.title,
    value: deal.value,
    status,
    stageId: deal.stage_id || null,
    closeDate,
    expectedCloseDate,
    jobType,
    quickbooksUrl,
    companyCamId,
    companyCamUrl,
    propertyAddress,
  };
}

/**
 * @deprecated  Use mapPipedrivePersonToCustomer instead.
 * Kept temporarily for the old sync/webhook routes during migration.
 */
export function mapPipedriveDealToCustomer(deal: PipedriveDeal) {
  const displayName = deal.title || `Deal #${deal.id}`;
  return {
    pipedriveId: deal.id.toString(),
    type: CustomerType.CLIENT,
    displayName,
    companyName: undefined as string | undefined,
    email: undefined as string | undefined,
    phone: undefined as string | undefined,
    pipedriveData: deal as any,
    active: deal.status === "open" || deal.status === "won",
  };
}

/**
 * Test Pipedrive API connectivity.
 */
export async function testConnection(): Promise<boolean> {
  try {
    // /deals is stable in v2, while /users/me can serve HTML app shell on some accounts.
    await pipedriveRequest("/deals?limit=1&status=open");
    return true;
  } catch (error) {
    console.error("[Pipedrive] Connection test failed:", error);
    return false;
  }
}
