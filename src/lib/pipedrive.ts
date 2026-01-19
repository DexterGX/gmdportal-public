/**
 * Pipedrive API Integration
 *
 * This module provides helpers for syncing deals and contacts from Pipedrive.
 * Data is synced to the local Customer database as PROSPECTS.
 *
 * Setup required:
 * 1. Get your Pipedrive API token from Settings > Personal Preferences > API
 * 2. Add these environment variables to .env.local:
 *    - PIPEDRIVE_API_TOKEN
 *    - PIPEDRIVE_COMPANY_DOMAIN (e.g., "yourcompany" for yourcompany.pipedrive.com)
 *
 * Docs: https://developers.pipedrive.com/docs/api/v1
 */

import { prisma } from "./prisma";
import { CustomerType } from "@prisma/client";

const PIPEDRIVE_API_VERSION = "v1";

interface PipedriveConfig {
  apiToken: string;
  companyDomain: string;
}

/**
 * Get Pipedrive configuration from environment
 */
function getConfig(): PipedriveConfig {
  const apiToken = process.env.PIPEDRIVE_API_TOKEN;
  const companyDomain = process.env.PIPEDRIVE_COMPANY_DOMAIN;

  if (!apiToken || !companyDomain) {
    throw new Error(
      "Missing Pipedrive configuration. Set PIPEDRIVE_API_TOKEN and PIPEDRIVE_COMPANY_DOMAIN in .env.local"
    );
  }

  return { apiToken, companyDomain };
}

/**
 * Get Pipedrive API base URL
 */
function getApiBase(): string {
  const { companyDomain } = getConfig();
  return `https://${companyDomain}.pipedrive.com/api/${PIPEDRIVE_API_VERSION}`;
}

/**
 * Make an authenticated request to Pipedrive API
 */
async function pipedriveRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const { apiToken } = getConfig();
  const baseUrl = getApiBase();

  // Add api_token to query params
  const url = new URL(`${baseUrl}${endpoint}`);
  url.searchParams.set("api_token", apiToken);

  const response = await fetch(url.toString(), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Pipedrive API error (${response.status}): ${error}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(`Pipedrive API error: ${data.error || "Unknown error"}`);
  }

  return data;
}

/**
 * Pipedrive Person (Contact) structure
 */
export interface PipedrivePerson {
  id: number;
  name: string;
  first_name?: string;
  last_name?: string;
  email?: Array<{ value: string; primary: boolean }>;
  phone?: Array<{ value: string; primary: boolean }>;
  org_id?:
    | {
        name: string;
        value: number;
      }
    | number
    | null;
  owner_id?: {
    id: number;
    name: string;
    email: string;
  };
  add_time?: string;
  update_time?: string;
  visible_to?: string;
  active_flag?: boolean;
}

/**
 * Pipedrive Deal structure
 */
export interface PipedriveDeal {
  id: number;
  title: string;
  value: number;
  currency: string;
  status: string; // "open", "won", "lost", "deleted"
  stage_id: number;
  stage_order_nr?: number;
  person_id?:
    | {
        name: string;
        email?: Array<{ value: string; primary: boolean }>;
        phone?: Array<{ value: string; primary: boolean }>;
        value: number;
      }
    | number
    | null;
  org_id?:
    | {
        name: string;
        value: number;
      }
    | number
    | null;
  add_time: string;
  update_time: string;
  close_time?: string | null;
  won_time?: string | null;
  lost_time?: string | null;
  expected_close_date?: string | null;
  owner_name?: string;
  cc_email?: string;
  notes_count?: number;
  visible_to?: string;
  org_name?: string;
  person_name?: string;
}

interface PipedriveListResponse<T> {
  success: boolean;
  data: T[];
  additional_data?: {
    pagination: {
      start: number;
      limit: number;
      more_items_in_collection: boolean;
      next_start?: number;
    };
  };
}

/**
 * Fetch all deals from Pipedrive with pagination
 */
export async function fetchAllDeals(
  status: "all_not_deleted" | "open" | "won" | "lost" = "all_not_deleted"
): Promise<PipedriveDeal[]> {
  const allDeals: PipedriveDeal[] = [];
  let start = 0;
  const limit = 100; // Max 500, but 100 is safer

  while (true) {
    const params = new URLSearchParams({
      start: start.toString(),
      limit: limit.toString(),
      status,
    });

    const response = await pipedriveRequest<
      PipedriveListResponse<PipedriveDeal>
    >(`/deals?${params.toString()}`);

    if (response.data && response.data.length > 0) {
      allDeals.push(...response.data);
    }

    // Check if there are more items
    if (
      !response.additional_data?.pagination?.more_items_in_collection ||
      !response.additional_data?.pagination?.next_start
    ) {
      break;
    }

    start = response.additional_data.pagination.next_start;
  }

  return allDeals;
}

/**
 * Fetch all persons (contacts) from Pipedrive with pagination
 */
export async function fetchAllPersons(): Promise<PipedrivePerson[]> {
  const allPersons: PipedrivePerson[] = [];
  let start = 0;
  const limit = 100;

  while (true) {
    const params = new URLSearchParams({
      start: start.toString(),
      limit: limit.toString(),
    });

    const response = await pipedriveRequest<
      PipedriveListResponse<PipedrivePerson>
    >(`/persons?${params.toString()}`);

    if (response.data && response.data.length > 0) {
      allPersons.push(...response.data);
    }

    if (
      !response.additional_data?.pagination?.more_items_in_collection ||
      !response.additional_data?.pagination?.next_start
    ) {
      break;
    }

    start = response.additional_data.pagination.next_start;
  }

  return allPersons;
}

/**
 * Fetch a specific person by ID
 */
export async function fetchPerson(
  personId: number
): Promise<PipedrivePerson | null> {
  try {
    const response = await pipedriveRequest<{
      success: boolean;
      data: PipedrivePerson;
    }>(`/persons/${personId}`);
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch person ${personId}:`, error);
    return null;
  }
}

/**
 * Helper to extract primary email from Pipedrive email array
 */
function getPrimaryEmail(
  emails?: Array<{ value: string; primary: boolean }>
): string | undefined {
  if (!emails || emails.length === 0) return undefined;
  const primary = emails.find((e) => e.primary);
  return primary?.value || emails[0]?.value;
}

/**
 * Helper to extract primary phone from Pipedrive phone array
 */
function getPrimaryPhone(
  phones?: Array<{ value: string; primary: boolean }>
): string | undefined {
  if (!phones || phones.length === 0) return undefined;
  const primary = phones.find((p) => p.primary);
  return primary?.value || phones[0]?.value;
}

/**
 * Helper to get organization name from various Pipedrive structures
 */
function getOrgName(
  org_id?: { name: string; value: number } | number | null,
  org_name?: string
): string | undefined {
  if (org_name) return org_name;
  if (org_id && typeof org_id === "object" && "name" in org_id) {
    return org_id.name;
  }
  return undefined;
}

/**
 * Map Pipedrive Deal to Customer database record
 */
export function mapPipedriveDealToCustomer(deal: PipedriveDeal) {
  const personId =
    typeof deal.person_id === "object" && deal.person_id
      ? deal.person_id.value
      : deal.person_id;
  const orgId =
    typeof deal.org_id === "object" && deal.org_id
      ? deal.org_id.value
      : deal.org_id;

  // Try to get email and phone from person_id if it's an object with details
  const email =
    typeof deal.person_id === "object" && deal.person_id
      ? getPrimaryEmail(deal.person_id.email)
      : undefined;
  const phone =
    typeof deal.person_id === "object" && deal.person_id
      ? getPrimaryPhone(deal.person_id.phone)
      : undefined;

  const companyName = getOrgName(deal.org_id, deal.org_name);
  const displayName =
    deal.person_name || deal.title || companyName || `Deal #${deal.id}`;

  return {
    pipedriveId: deal.id.toString(),
    type: CustomerType.PROSPECT,
    displayName,
    companyName,
    email,
    phone,
    pipedriveData: deal,
    active: deal.status === "open" || deal.status === "won",
  };
}

/**
 * Map Pipedrive Person to Customer database record
 */
export function mapPipedrivePersonToCustomer(person: PipedrivePerson) {
  const email = getPrimaryEmail(person.email);
  const phone = getPrimaryPhone(person.phone);
  const companyName = getOrgName(person.org_id);

  return {
    pipedriveId: person.id.toString(),
    type: CustomerType.PROSPECT,
    displayName: person.name,
    companyName,
    givenName: person.first_name,
    familyName: person.last_name,
    email,
    phone,
    pipedriveData: person,
    active: person.active_flag ?? true,
  };
}

/**
 * Sync deals from Pipedrive to local database
 * Returns stats about created/updated records
 */
export async function syncDealsToDatabase(
  deals: PipedriveDeal[],
  onProgress?: (current: number, total: number) => void
): Promise<{
  created: number;
  updated: number;
  errors: number;
}> {
  let created = 0;
  let updated = 0;
  let errors = 0;

  for (let i = 0; i < deals.length; i++) {
    const deal = deals[i];

    try {
      const customerData = mapPipedriveDealToCustomer(deal);

      const existing = await prisma.customer.findUnique({
        where: { pipedriveId: customerData.pipedriveId },
      });

      if (existing) {
        await prisma.customer.update({
          where: { pipedriveId: customerData.pipedriveId },
          data: {
            ...customerData,
            pipedriveData: JSON.parse(
              JSON.stringify(customerData.pipedriveData)
            ),
            updatedAt: new Date(),
          },
        });
        updated++;
      } else {
        await prisma.customer.create({
          data: {
            ...customerData,
            pipedriveData: JSON.parse(
              JSON.stringify(customerData.pipedriveData)
            ),
          },
        });
        created++;
      }
    } catch (error) {
      console.error(`Error syncing deal ${deal.id}:`, error);
      errors++;
    }

    if (onProgress) {
      onProgress(i + 1, deals.length);
    }
  }

  return { created, updated, errors };
}

/**
 * Test Pipedrive API connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    await pipedriveRequest("/users/me");
    return true;
  } catch (error) {
    console.error("Pipedrive connection test failed:", error);
    return false;
  }
}
