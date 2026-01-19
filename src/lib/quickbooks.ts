/**
 * QuickBooks Online API Integration - READ-ONLY
 *
 * ⚠️ IMPORTANT: This integration is READ-ONLY and will NEVER modify QuickBooks data.
 * All operations only fetch/read customer information from QuickBooks.
 * Data is only written to the local database, never back to QuickBooks.
 *
 * This module provides helpers for syncing customer data from QuickBooks Online.
 *
 * Setup required:
 * 1. Create a QuickBooks app at https://developer.intuit.com
 * 2. Add these environment variables to .env.local:
 *    - QUICKBOOKS_CLIENT_ID
 *    - QUICKBOOKS_CLIENT_SECRET
 *    - QUICKBOOKS_REDIRECT_URI (e.g., http://localhost:3000/api/quickbooks/callback)
 *    - QUICKBOOKS_REALM_ID (Company ID)
 *    - QUICKBOOKS_ACCESS_TOKEN
 *    - QUICKBOOKS_REFRESH_TOKEN
 *
 * OAuth 2.0 flow is needed to obtain initial tokens.
 */

import { prisma } from "./prisma";

const QB_API_BASE = "https://quickbooks.api.intuit.com/v3/company";
const QB_SANDBOX_API_BASE =
  "https://sandbox-quickbooks.api.intuit.com/v3/company";

// In-memory token cache to avoid DB hits on every request
let tokenCache: {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  realmId: string;
} | null = null;

export interface QuickBooksCustomer {
  Id: string;
  DisplayName: string;
  CompanyName?: string;
  GivenName?: string;
  FamilyName?: string;
  Job?: boolean; // true if this is a sub-customer/job
  ParentRef?: {
    value: string; // ID of parent customer
    name?: string;
  };
  Notes?: string; // Customer notes/memo
  PrimaryEmailAddr?: {
    Address: string;
  };
  PrimaryPhone?: {
    FreeFormNumber: string;
  };
  Mobile?: {
    FreeFormNumber: string;
  };
  BillAddr?: {
    Line1?: string;
    Line2?: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
    Country?: string;
  };
  ShipAddr?: {
    Line1?: string;
    Line2?: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
    Country?: string;
  };
  Balance?: number;
  Active?: boolean;
  MetaData?: {
    CreateTime: string;
    LastUpdatedTime: string;
  };
}

export interface QuickBooksQueryResponse {
  QueryResponse: {
    Customer?: QuickBooksCustomer[];
    startPosition?: number;
    maxResults?: number;
    totalCount?: number;
  };
}

/**
 * Get QuickBooks API base URL (use sandbox for development)
 */
function getApiBase(): string {
  return process.env.QUICKBOOKS_ENVIRONMENT === "production"
    ? QB_API_BASE
    : QB_SANDBOX_API_BASE;
}

/**
 * Get valid QuickBooks tokens (auto-refreshes if expired)
 */
async function getValidTokens(): Promise<{
  accessToken: string;
  realmId: string;
}> {
  // Check cache first
  if (tokenCache && tokenCache.expiresAt > new Date()) {
    return {
      accessToken: tokenCache.accessToken,
      realmId: tokenCache.realmId,
    };
  }

  // Try to get from database
  const dbTokens = await prisma.quickBooksTokens.findFirst({
    orderBy: { updatedAt: "desc" },
  });

  if (dbTokens) {
    // Check if token is still valid (with 5 min buffer)
    const bufferTime = new Date(Date.now() + 5 * 60 * 1000);

    if (dbTokens.expiresAt > bufferTime) {
      // Token is still valid, cache it
      tokenCache = {
        accessToken: dbTokens.accessToken,
        refreshToken: dbTokens.refreshToken,
        expiresAt: dbTokens.expiresAt,
        realmId: dbTokens.realmId,
      };
      return {
        accessToken: dbTokens.accessToken,
        realmId: dbTokens.realmId,
      };
    }

    // Token expired, refresh it
    const newTokens = await refreshTokensInternal(dbTokens.refreshToken);

    // Update database
    await prisma.quickBooksTokens.update({
      where: { id: dbTokens.id },
      data: {
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token,
        expiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
      },
    });

    // Update cache
    tokenCache = {
      accessToken: newTokens.access_token,
      refreshToken: newTokens.refresh_token,
      expiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
      realmId: dbTokens.realmId,
    };

    return {
      accessToken: newTokens.access_token,
      realmId: dbTokens.realmId,
    };
  }

  // Fallback to environment variables (for initial setup)
  const envToken = process.env.QUICKBOOKS_ACCESS_TOKEN;
  const envRealmId = process.env.QUICKBOOKS_REALM_ID;

  if (!envToken || !envRealmId) {
    throw new Error(
      "QuickBooks tokens not found in database or environment variables. Please run initial setup."
    );
  }

  return {
    accessToken: envToken,
    realmId: envRealmId,
  };
}

/**
 * Internal token refresh function
 */
async function refreshTokensInternal(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("QuickBooks credentials not configured");
  }

  const response = await fetch(
    "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${clientId}:${clientSecret}`
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    let errorObj;
    try {
      errorObj = JSON.parse(error);
    } catch {
      errorObj = { error: "unknown", error_description: error };
    }

    // Check if it's an invalid/expired refresh token
    if (errorObj.error === "invalid_grant") {
      throw new Error(
        "QuickBooks refresh token has expired. Please re-authenticate by clicking 'Update Tokens' on the sync page and getting new tokens from QuickBooks OAuth Playground."
      );
    }

    throw new Error(`Failed to refresh QuickBooks token: ${error}`);
  }

  return response.json();
}

/**
 * Refresh QuickBooks access token using refresh token (DEPRECATED - use getValidTokens instead)
 * This is kept for backward compatibility but the automatic refresh is now handled internally.
 */
export async function refreshQuickBooksToken(): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const refreshToken = process.env.QUICKBOOKS_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error("QuickBooks refresh token not configured");
  }
  return refreshTokensInternal(refreshToken);
}

/**
 * Fetch all customers from QuickBooks (READ-ONLY)
 *
 * This function only READS customer data from QuickBooks.
 * It does NOT create, update, or delete any QuickBooks records.
 *
 * @param maxResults - Max results per page (default 1000)
 * @param startPosition - Start position for pagination (default 1)
 */
export async function fetchQuickBooksCustomers(
  maxResults: number = 1000,
  startPosition: number = 1
): Promise<QuickBooksCustomer[]> {
  // Get valid tokens (auto-refreshes if needed)
  const { accessToken, realmId } = await getValidTokens();

  const query = `SELECT * FROM Customer STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`;
  const url = `${getApiBase()}/${realmId}/query?query=${encodeURIComponent(
    query
  )}&minorversion=65`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch QuickBooks customers: ${error}`);
  }

  const data: QuickBooksQueryResponse = await response.json();

  // Check if the response has the expected structure
  if (!data.QueryResponse) {
    console.error("Unexpected QuickBooks response:", JSON.stringify(data));
    throw new Error(
      `Invalid QuickBooks response format. Expected QueryResponse but got: ${JSON.stringify(
        data
      ).substring(0, 200)}`
    );
  }

  return data.QueryResponse.Customer || [];
}

/**
 * Fetch ALL customers from QuickBooks with automatic pagination (READ-ONLY)
 *
 * This function handles pagination automatically to fetch all customers,
 * regardless of how many exist (handles 1000s of customers).
 *
 * @returns All customers from QuickBooks
 */
export async function fetchAllQuickBooksCustomers(): Promise<
  QuickBooksCustomer[]
> {
  const allCustomers: QuickBooksCustomer[] = [];
  let startPosition = 1;
  const maxResults = 1000; // QuickBooks max per page
  let hasMore = true;

  while (hasMore) {
    const customers = await fetchQuickBooksCustomers(maxResults, startPosition);

    if (customers.length === 0) {
      hasMore = false;
    } else {
      allCustomers.push(...customers);

      // If we got less than maxResults, we've reached the end
      if (customers.length < maxResults) {
        hasMore = false;
      } else {
        // Move to next page
        startPosition += maxResults;
      }
    }
  }

  return allCustomers;
}

/**
 * Fetch a single customer by QuickBooks ID (READ-ONLY)
 *
 * This function only READS customer data from QuickBooks.
 * It does NOT modify any QuickBooks records.
 */
export async function fetchQuickBooksCustomer(
  customerId: string
): Promise<QuickBooksCustomer> {
  // Get valid tokens (auto-refreshes if needed)
  const { accessToken, realmId } = await getValidTokens();

  const url = `${getApiBase()}/${realmId}/customer/${customerId}?minorversion=65`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch QuickBooks customer: ${error}`);
  }

  const data = await response.json();
  return data.Customer;
}

/**
 * Sync a specific customer from QuickBooks to local database
 * Used by webhooks to sync individual customer changes
 */
export async function syncCustomerFromQuickBooks(
  quickbooksId: string
): Promise<void> {
  // Fetch the customer from QuickBooks
  const qbCustomer = await fetchQuickBooksCustomer(quickbooksId);
  const customerData = mapQuickBooksCustomerToDb(qbCustomer);

  // Check if customer already exists
  const existing = await prisma.customer.findUnique({
    where: { quickbooksId },
  });

  if (existing) {
    // Update existing customer
    await prisma.customer.update({
      where: { quickbooksId },
      data: customerData,
    });
  } else {
    // Create new customer
    await prisma.customer.create({
      data: customerData,
    });
  }
}

/**
 * Convert QuickBooks customer to our database format
 */
export function mapQuickBooksCustomerToDb(qbCustomer: QuickBooksCustomer) {
  // Detect if this is a contractor based on notes/display name
  const isContractor = 
    (qbCustomer.Notes?.toLowerCase().includes('contractor') || false) ||
    (qbCustomer.DisplayName?.toLowerCase().includes('contractor') || false);

  return {
    quickbooksId: qbCustomer.Id,
    type: isContractor ? ("CONTRACTOR" as const) : ("CLIENT" as const),
    syncedToQB: true,
    displayName: qbCustomer.DisplayName,
    companyName: qbCustomer.CompanyName || null,
    givenName: qbCustomer.GivenName || null,
    familyName: qbCustomer.FamilyName || null,
    email: qbCustomer.PrimaryEmailAddr?.Address || null,
    phone: qbCustomer.PrimaryPhone?.FreeFormNumber || null,
    mobile: qbCustomer.Mobile?.FreeFormNumber || null,
    billAddr: qbCustomer.BillAddr ? qbCustomer.BillAddr : undefined,
    shipAddr: qbCustomer.ShipAddr ? qbCustomer.ShipAddr : undefined,
    balance: qbCustomer.Balance || 0,
    active: qbCustomer.Active !== false,
    notes: qbCustomer.Notes || null,
    quickbooksData: qbCustomer as any,
    lastSyncedAt: new Date(),
  };
}

/**
 * Extract job name from full display name
 * Example: "Gama, Diego - Countertops" → "Countertops"
 */
export function extractJobName(displayName: string, parentName: string): string {
  // Remove parent name and separator
  const jobPart = displayName.replace(parentName, '').trim();
  // Remove leading dash/colon and trim
  return jobPart.replace(/^[-:]\s*/, '').trim() || 'Main Project';
}
