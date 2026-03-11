"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";

export type SampleRequestStatus =
  | "REQUESTED"
  | "IN_PROGRESS"
  | "ORDERED"
  | "DELIVERED"
  | "CANCELED";

export type SampleRequestType = "CABINET" | "COUNTERTOP";

export type SampleRequestProvider = {
  id: string;
  name: string;
  sampleType: SampleRequestType;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  contactMethod?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type SampleRequest = {
  id: string;
  status: SampleRequestStatus;
  sampleType: SampleRequestType;
  brand: string;
  colorName: string;
  quantity: number;
  notes?: string | null;
  jobId?: string | null;
  customerId?: string | null;
  jobName?: string | null;
  requestedByUserId?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SampleRequestHistory = {
  id: string;
  requestId: string;
  fromStatus?: SampleRequestStatus | null;
  toStatus?: SampleRequestStatus | null;
  message?: string | null;
  changedByUserId?: string | null;
  createdAt: Date;
};

const prismaClient = prisma as any;

export type SampleRequestWithRelations = SampleRequest & {
  job?: {
    id: string;
    jobNumber: number;
    jobName: string;
    customer: {
      id: string;
      displayName: string;
      companyName: string | null;
    };
  } | null;
  customer?: {
    id: string;
    displayName: string;
    companyName: string | null;
  } | null;
  requestedByUser?: { id: string; name: string | null } | null;
};

export type SampleRequestHistoryWithRelations = SampleRequestHistory & {
  request: SampleRequestWithRelations;
  changedByUser?: { id: string; name: string | null } | null;
};

export async function getSampleRequestProviders(filters?: {
  sampleType?: SampleRequestType;
  includeInactive?: boolean;
  search?: string;
}): Promise<SampleRequestProvider[]> {
  try {
    const where: any = {};

    if (filters?.sampleType) {
      where.sampleType = filters.sampleType;
    }

    if (!filters?.includeInactive) {
      where.isActive = true;
    }

    if (filters?.search) {
      const term = filters.search.trim();
      where.name = { contains: term, mode: "insensitive" };
    }

    return (await prismaClient.sampleRequestProvider.findMany({
      where,
      orderBy: [{ sampleType: "asc" }, { name: "asc" }],
    })) as SampleRequestProvider[];
  } catch (error) {
    console.error("Error fetching sample request providers:", error);
    throw new Error("Failed to fetch providers");
  }
}

export async function createSampleRequestProvider(data: {
  name: string;
  sampleType: SampleRequestType;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  contactMethod?: string;
  notes?: string;
  isActive?: boolean;
}): Promise<SampleRequestProvider> {
  try {
    return (await prismaClient.sampleRequestProvider.create({
      data: {
        name: data.name.trim(),
        sampleType: data.sampleType,
        contactName: data.contactName?.trim() || null,
        contactPhone: data.contactPhone?.trim() || null,
        contactEmail: data.contactEmail?.trim() || null,
        contactMethod: data.contactMethod?.trim() || null,
        notes: data.notes?.trim() || null,
        isActive: data.isActive ?? true,
      },
    })) as SampleRequestProvider;
  } catch (error) {
    console.error("Error creating sample request provider:", error);
    throw new Error("Failed to create provider");
  }
}

export async function updateSampleRequestProvider(data: {
  id: string;
  name?: string;
  sampleType?: SampleRequestType;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  contactMethod?: string | null;
  notes?: string | null;
  isActive?: boolean;
}): Promise<SampleRequestProvider> {
  try {
    return (await prismaClient.sampleRequestProvider.update({
      where: { id: data.id },
      data: {
        name: data.name?.trim(),
        sampleType: data.sampleType,
        contactName:
          data.contactName === undefined
            ? undefined
            : data.contactName?.trim() || null,
        contactPhone:
          data.contactPhone === undefined
            ? undefined
            : data.contactPhone?.trim() || null,
        contactEmail:
          data.contactEmail === undefined
            ? undefined
            : data.contactEmail?.trim() || null,
        contactMethod:
          data.contactMethod === undefined
            ? undefined
            : data.contactMethod?.trim() || null,
        notes:
          data.notes === undefined ? undefined : data.notes?.trim() || null,
        isActive: data.isActive,
      },
    })) as SampleRequestProvider;
  } catch (error) {
    console.error("Error updating sample request provider:", error);
    throw new Error("Failed to update provider");
  }
}

export async function deleteSampleRequestProvider(id: string): Promise<void> {
  try {
    await prismaClient.sampleRequestProvider.delete({ where: { id } });
  } catch (error) {
    console.error("Error deleting sample request provider:", error);
    throw new Error("Failed to delete provider");
  }
}

export async function getSampleRequests(filters?: {
  search?: string;
  status?: SampleRequestStatus;
  sampleType?: SampleRequestType;
}): Promise<SampleRequestWithRelations[]> {
  try {
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.sampleType) {
      where.sampleType = filters.sampleType;
    }

    if (filters?.search) {
      const term = filters.search.trim();
      const jobNumber = Number(term);
      where.OR = [
        { brand: { contains: term, mode: "insensitive" } },
        { colorName: { contains: term, mode: "insensitive" } },
        { jobName: { contains: term, mode: "insensitive" } },
        {
          customer: {
            displayName: { contains: term, mode: "insensitive" },
          },
        },
        {
          job: {
            jobName: { contains: term, mode: "insensitive" },
          },
        },
      ];

      if (Number.isFinite(jobNumber)) {
        where.OR.push({ job: { jobNumber } });
      }
    }

    return (await prismaClient.sampleRequest.findMany({
      where,
      include: {
        job: {
          select: {
            id: true,
            jobNumber: true,
            jobName: true,
            customer: {
              select: {
                id: true,
                displayName: true,
                companyName: true,
              },
            },
          },
        },
        customer: {
          select: { id: true, displayName: true, companyName: true },
        },
        requestedByUser: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })) as SampleRequestWithRelations[];
  } catch (error) {
    console.error("Error fetching sample requests:", error);
    throw new Error("Failed to fetch sample requests");
  }
}

export async function getSampleRequestById(
  requestId: string,
): Promise<SampleRequestWithRelations | null> {
  try {
    return (await prismaClient.sampleRequest.findUnique({
      where: { id: requestId },
      include: {
        job: {
          select: {
            id: true,
            jobNumber: true,
            jobName: true,
            customer: {
              select: {
                id: true,
                displayName: true,
                companyName: true,
              },
            },
          },
        },
        customer: {
          select: { id: true, displayName: true, companyName: true },
        },
        requestedByUser: {
          select: { id: true, name: true },
        },
      },
    })) as SampleRequestWithRelations | null;
  } catch (error) {
    console.error("Error fetching sample request:", error);
    throw new Error("Failed to fetch sample request");
  }
}

export async function getSampleRequestHistory(filters?: {
  search?: string;
  status?: SampleRequestStatus;
  requestId?: string;
}): Promise<SampleRequestHistoryWithRelations[]> {
  try {
    const where: any = {};

    if (filters?.requestId) {
      where.requestId = filters.requestId;
    }

    if (filters?.status) {
      where.toStatus = filters.status;
    }

    if (filters?.search) {
      const term = filters.search.trim();
      const jobNumber = Number(term);
      where.OR = [
        { request: { brand: { contains: term, mode: "insensitive" } } },
        { request: { colorName: { contains: term, mode: "insensitive" } } },
        { request: { jobName: { contains: term, mode: "insensitive" } } },
        {
          request: {
            customer: {
              displayName: { contains: term, mode: "insensitive" },
            },
          },
        },
        {
          request: {
            job: {
              jobName: { contains: term, mode: "insensitive" },
            },
          },
        },
      ];

      if (Number.isFinite(jobNumber)) {
        where.OR.push({ request: { job: { jobNumber } } });
      }
    }

    return (await prismaClient.sampleRequestHistory.findMany({
      where,
      include: {
        request: {
          include: {
            job: {
              select: {
                id: true,
                jobNumber: true,
                jobName: true,
                customer: {
                  select: {
                    id: true,
                    displayName: true,
                    companyName: true,
                  },
                },
              },
            },
            customer: {
              select: { id: true, displayName: true, companyName: true },
            },
            requestedByUser: {
              select: { id: true, name: true },
            },
          },
        },
        changedByUser: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    })) as SampleRequestHistoryWithRelations[];
  } catch (error) {
    console.error("Error fetching sample request history:", error);
    throw new Error("Failed to fetch history");
  }
}

export async function createSampleRequest(data: {
  jobId?: string;
  customerId?: string;
  jobName?: string;
  sampleType: SampleRequestType;
  brand: string;
  colorName: string;
  quantity: number;
  notes?: string;
  requestedByUserId: string;
}): Promise<SampleRequestWithRelations> {
  try {
    return (await prismaClient.$transaction(async (trx: any) => {
      const request = await trx.sampleRequest.create({
        data: {
          jobId: data.jobId || null,
          customerId: data.customerId || null,
          jobName: data.jobName || null,
          sampleType: data.sampleType,
          brand: data.brand,
          colorName: data.colorName,
          quantity: data.quantity,
          notes: data.notes || null,
          requestedByUserId: data.requestedByUserId,
          status: "REQUESTED",
        },
        include: {
          job: {
            select: {
              id: true,
              jobNumber: true,
              jobName: true,
              customer: {
                select: {
                  id: true,
                  displayName: true,
                  companyName: true,
                },
              },
            },
          },
          customer: {
            select: { id: true, displayName: true, companyName: true },
          },
          requestedByUser: {
            select: { id: true, name: true },
          },
        },
      });

      await trx.sampleRequestHistory.create({
        data: {
          requestId: request.id,
          toStatus: "REQUESTED",
          message: "Request created",
          changedByUserId: data.requestedByUserId,
        },
      });

      return request as SampleRequestWithRelations;
    })) as SampleRequestWithRelations;
  } catch (error) {
    console.error("Error creating sample request:", error);
    throw new Error("Failed to create sample request");
  }
}

export async function updateSampleRequestStatus(data: {
  requestId: string;
  status: SampleRequestStatus;
  userId: string;
  message?: string;
}): Promise<SampleRequestWithRelations> {
  try {
    const { user, appRole, isActive } = await getCurrentUserWithRole();
    if (!user || !isActive) {
      throw new Error("Not authorized");
    }
    if (user.id !== data.userId) {
      throw new Error("Not authorized");
    }

    const allowedRoles =
      data.status === "CANCELED"
        ? ["admin", "office", "sales"]
        : ["admin", "office"];

    if (!allowedRoles.includes(appRole)) {
      throw new Error("Not authorized");
    }

    return (await prismaClient.$transaction(async (trx: any) => {
      const existing = await trx.sampleRequest.findUnique({
        where: { id: data.requestId },
      });

      if (!existing) {
        throw new Error("Sample request not found");
      }

      if (existing.status === data.status) {
        return (await trx.sampleRequest.findUnique({
          where: { id: data.requestId },
          include: {
            job: {
              select: {
                id: true,
                jobNumber: true,
                jobName: true,
                customer: {
                  select: {
                    id: true,
                    displayName: true,
                    companyName: true,
                  },
                },
              },
            },
            customer: {
              select: { id: true, displayName: true, companyName: true },
            },
            requestedByUser: {
              select: { id: true, name: true },
            },
          },
        })) as SampleRequestWithRelations;
      }

      const request = await trx.sampleRequest.update({
        where: { id: data.requestId },
        data: { status: data.status },
        include: {
          job: {
            select: {
              id: true,
              jobNumber: true,
              jobName: true,
              customer: {
                select: {
                  id: true,
                  displayName: true,
                  companyName: true,
                },
              },
            },
          },
          customer: {
            select: { id: true, displayName: true, companyName: true },
          },
          requestedByUser: {
            select: { id: true, name: true },
          },
        },
      });

      await trx.sampleRequestHistory.create({
        data: {
          requestId: data.requestId,
          fromStatus: existing.status,
          toStatus: data.status,
          message: data.message || null,
          changedByUserId: data.userId,
        },
      });

      return request as SampleRequestWithRelations;
    })) as SampleRequestWithRelations;
  } catch (error) {
    console.error("Error updating sample request:", error);
    throw new Error("Failed to update status");
  }
}

export async function cancelSampleRequest(data: {
  requestId: string;
  userId: string;
  message?: string;
}): Promise<SampleRequestWithRelations> {
  return updateSampleRequestStatus({
    requestId: data.requestId,
    status: "CANCELED",
    userId: data.userId,
    message: data.message || "Request canceled",
  });
}
