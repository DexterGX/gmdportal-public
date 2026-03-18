export type SlabDeliveryType =
  | "SLAB"
  | "GMD"
  | "REMNANT"
  | "RESERVED"
  | "CLIENT_SLAB";

export type SlabDeliveryExpectation = {
  id: string;
  clientName: string;
  originalClientName?: string;
  slabName: string;
  brand: string;
  thickness: string;
  finish?: string;
  quantity: number;
  slabType: SlabDeliveryType;
  jobId?: string;
  notes?: string;
  extraNotes: string[];
  createdAt: string;
  createdBy: string;
};

export type CreateSlabDeliveryExpectationInput = Omit<
  SlabDeliveryExpectation,
  "id" | "createdAt" | "createdBy"
>;

export const fetchExpectedDeliveries = async (): Promise<
  SlabDeliveryExpectation[]
> => {
  const response = await fetch("/api/slab-rack-display/expected-deliveries", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to load expected deliveries.");
  }

  return (await response.json()) as SlabDeliveryExpectation[];
};

export const createExpectedDelivery = async (
  input: CreateSlabDeliveryExpectationInput,
) => {
  const response = await fetch("/api/slab-rack-display/expected-deliveries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(data?.error || "Failed to create expected delivery.");
  }

  return (await response.json()) as SlabDeliveryExpectation;
};

export const deleteExpectedDelivery = async (deliveryId: string) => {
  const response = await fetch(
    `/api/slab-rack-display/expected-deliveries/${deliveryId}`,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(data?.error || "Failed to remove expected delivery.");
  }
};
