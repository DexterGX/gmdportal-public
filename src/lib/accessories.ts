"use server";

import { prisma } from "@/lib/prisma";
import type {
  AccessoryTracker,
  AccessoryItem,
  AccessoryItemEvent,
  AccessoryItemStatus,
  AccessoryCategory,
  AccessoryPriority,
  AccessoryDepartment,
  AccessoryEventType,
} from "@prisma/client";

// Type definitions for API responses
export type AccessoryTrackerWithRelations = AccessoryTracker & {
  job: {
    id: string;
    jobNumber: number;
    jobName: string;
    customer: {
      id: string;
      displayName: string;
      phone: string | null;
      email: string | null;
    };
  };
  items: AccessoryItemWithUser[];
};

export type AccessoryItemWithUser = AccessoryItem & {
  assignedToUser?: { id: string; name: string | null } | null;
  createdByUser?: { id: string; name: string | null } | null;
  updatedByUser?: { id: string; name: string | null } | null;
};

export type AccessoryItemEventWithUser = AccessoryItemEvent & {
  changedByUser?: { id: string; name: string | null } | null;
};

export type AccessoryItemWithEvents = AccessoryItemWithUser & {
  events?: AccessoryItemEventWithUser[];
};

export type AccessoryTrackerDetail = AccessoryTracker & {
  job: {
    id: string;
    jobNumber: number;
    jobName: string;
    status: string;
    value: number | null;
    customer: {
      id: string;
      displayName: string;
      companyName: string | null;
      phone: string | null;
      mobile: string | null;
      email: string | null;
      billAddr: any;
      shipAddr: any;
    };
  };
  items: AccessoryItemWithEvents[];
  createdByUser?: { id: string; name: string | null } | null;
  updatedByUser?: { id: string; name: string | null } | null;
};

// List trackers with filters
export async function getAccessoryTrackers(filters?: {
  search?: string;
  jobId?: string;
  customerId?: string;
  status?: AccessoryItemStatus;
  department?: AccessoryDepartment;
  needsAttention?: boolean;
}): Promise<AccessoryTrackerWithRelations[]> {
  try {
    const where: any = {};

    if (filters?.jobId) {
      where.jobId = filters.jobId;
    }

    if (filters?.department) {
      where.department = filters.department;
    }

    if (filters?.customerId) {
      where.job = { customerId: filters.customerId };
    }

    if (filters?.search) {
      where.OR = [
        { job: { jobName: { contains: filters.search, mode: "insensitive" } } },
        {
          job: {
            customer: {
              displayName: { contains: filters.search, mode: "insensitive" },
            },
          },
        },
        { notes: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    // If filtering by item status, need to join through items
    if (filters?.status) {
      where.items = {
        some: {
          status: filters.status,
        },
      };
    }

    const trackers = (await prisma.accessoryTracker.findMany({
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
                phone: true,
                email: true,
              },
            },
          },
        },
        items: {
          include: {
            assignedToUser: {
              select: { id: true, name: true },
            },
            updatedByUser: {
              select: { id: true, name: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    })) as AccessoryTrackerWithRelations[];

    // Filter needs attention if requested
    if (filters?.needsAttention) {
      return trackers.filter((tracker) =>
        tracker.items.some(
          (item: AccessoryItemWithUser) =>
            item.status === "ISSUE" ||
            (item.etaAt &&
              item.etaAt < new Date() &&
              !["DELIVERED", "CHECKED_IN", "INSTALLED", "NOT_NEEDED"].includes(
                item.status,
              )),
        ),
      );
    }

    return trackers;
  } catch (error) {
    console.error("Error fetching accessory trackers:", error);
    throw new Error("Failed to fetch accessory trackers");
  }
}

// Get single tracker with full details
export async function getAccessoryTracker(
  trackerId: string,
): Promise<AccessoryTrackerDetail | null> {
  try {
    const tracker = (await prisma.accessoryTracker.findUnique({
      where: { id: trackerId },
      include: {
        job: {
          select: {
            id: true,
            jobNumber: true,
            jobName: true,
            status: true,
            value: true,
            customer: {
              select: {
                id: true,
                displayName: true,
                companyName: true,
                phone: true,
                mobile: true,
                email: true,
                billAddr: true,
                shipAddr: true,
              },
            },
          },
        },
        items: {
          include: {
            assignedToUser: {
              select: { id: true, name: true, email: true },
            },
            createdByUser: {
              select: { id: true, name: true },
            },
            updatedByUser: {
              select: { id: true, name: true },
            },
            events: {
              include: {
                changedByUser: {
                  select: { id: true, name: true },
                },
              },
              orderBy: { createdAt: "desc" },
              take: 50,
            },
          },
          orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        },
        createdByUser: {
          select: { id: true, name: true },
        },
        updatedByUser: {
          select: { id: true, name: true },
        },
      },
    })) as AccessoryTrackerDetail | null;

    return tracker;
  } catch (error) {
    console.error("Error fetching accessory tracker:", error);
    throw new Error("Failed to fetch accessory tracker");
  }
}

// Create new tracker
export async function createAccessoryTracker(data: {
  jobId: string;
  invoiceNumber?: string;
  invoiceCreatedAt?: Date;
  remeasureApprovedAt?: Date;
  department?: AccessoryDepartment;
  notes?: string;
  createdByUserId: string;
}) {
  try {
    // Check if tracker already exists for this job
    const existing = await prisma.accessoryTracker.findUnique({
      where: { jobId: data.jobId },
    });

    if (existing) {
      throw new Error("Accessory tracker already exists for this job");
    }

    const tracker = await prisma.accessoryTracker.create({
      data: {
        jobId: data.jobId,
        invoiceNumber: data.invoiceNumber,
        invoiceCreatedAt: data.invoiceCreatedAt,
        remeasureApprovedAt: data.remeasureApprovedAt,
        department: data.department,
        notes: data.notes,
        createdByUserId: data.createdByUserId,
        updatedByUserId: data.createdByUserId,
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
              },
            },
          },
        },
      },
    });

    return tracker;
  } catch (error) {
    console.error("Error creating accessory tracker:", error);
    throw error;
  }
}

// Update tracker
export async function updateAccessoryTracker(
  trackerId: string,
  data: {
    invoiceNumber?: string | null;
    invoiceCreatedAt?: Date | null;
    remeasureApprovedAt?: Date | null;
    department?: AccessoryDepartment | null;
    notes?: string | null;
    updatedByUserId: string;
  },
) {
  try {
    const tracker = await prisma.accessoryTracker.update({
      where: { id: trackerId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });

    return tracker;
  } catch (error) {
    console.error("Error updating accessory tracker:", error);
    throw new Error("Failed to update accessory tracker");
  }
}

// Add item to tracker
export async function addAccessoryItem(
  trackerId: string,
  data: {
    category: AccessoryCategory;
    name: string;
    quantity: number;
    sku?: string;
    vendor?: string;
    linkUrl?: string;
    cost?: number;
    retail?: number;
    status?: AccessoryItemStatus;
    priority?: AccessoryPriority;
    assignedToUserId?: string;
    etaAt?: Date;
    createdByUserId: string;
  },
) {
  try {
    const item = await prisma.accessoryItem.create({
      data: {
        trackerId,
        category: data.category,
        name: data.name,
        quantity: data.quantity,
        sku: data.sku,
        vendor: data.vendor,
        linkUrl: data.linkUrl,
        cost: data.cost,
        retail: data.retail,
        status: data.status || "READY_TO_ORDER",
        priority: data.priority || "NORMAL",
        assignedToUserId: data.assignedToUserId,
        etaAt: data.etaAt,
        lastStatusChangedAt: new Date(),
        createdByUserId: data.createdByUserId,
        updatedByUserId: data.createdByUserId,
      },
    });

    // Create initial event
    await prisma.accessoryItemEvent.create({
      data: {
        itemId: item.id,
        type: "CREATED",
        toStatus: item.status,
        message: `Item created: ${item.name}`,
        changedByUserId: data.createdByUserId,
      },
    });

    return item;
  } catch (error) {
    console.error("Error adding accessory item:", error);
    throw new Error("Failed to add accessory item");
  }
}

// Update item
export async function updateAccessoryItem(
  itemId: string,
  data: {
    category?: AccessoryCategory;
    name?: string;
    quantity?: number;
    sku?: string | null;
    vendor?: string | null;
    linkUrl?: string | null;
    cost?: number | null;
    retail?: number | null;
    priority?: AccessoryPriority;
    assignedToUserId?: string | null;
    etaAt?: Date | null;
    updatedByUserId: string;
  },
) {
  try {
    const item = await prisma.accessoryItem.update({
      where: { id: itemId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });

    // Log field edit event
    await prisma.accessoryItemEvent.create({
      data: {
        itemId,
        type: "FIELD_EDIT",
        message: "Item details updated",
        changedByUserId: data.updatedByUserId,
      },
    });

    return item;
  } catch (error) {
    console.error("Error updating accessory item:", error);
    throw new Error("Failed to update accessory item");
  }
}

// Change item status (with auto-date setting)
export async function changeAccessoryItemStatus(
  itemId: string,
  newStatus: AccessoryItemStatus,
  userId: string,
  options?: {
    note?: string;
    orderedAt?: Date;
    etaAt?: Date;
    deliveredAt?: Date;
    checkedInAt?: Date;
    installedAt?: Date;
  },
) {
  try {
    // Get current item
    const currentItem = await prisma.accessoryItem.findUnique({
      where: { id: itemId },
      select: {
        status: true,
        orderedAt: true,
        deliveredAt: true,
        checkedInAt: true,
        installedAt: true,
      },
    });

    if (!currentItem) {
      throw new Error("Item not found");
    }

    const updateData: any = {
      status: newStatus,
      lastStatusChangedAt: new Date(),
      updatedByUserId: userId,
      updatedAt: new Date(),
    };

    // Auto-set dates based on status if not manually provided
    if (
      newStatus === "ORDERED" &&
      !currentItem.orderedAt &&
      !options?.orderedAt
    ) {
      updateData.orderedAt = new Date();
    } else if (options?.orderedAt !== undefined) {
      updateData.orderedAt = options.orderedAt;
    }

    if (
      newStatus === "DELIVERED" &&
      !currentItem.deliveredAt &&
      !options?.deliveredAt
    ) {
      updateData.deliveredAt = new Date();
    } else if (options?.deliveredAt !== undefined) {
      updateData.deliveredAt = options.deliveredAt;
    }

    if (
      newStatus === "CHECKED_IN" &&
      !currentItem.checkedInAt &&
      !options?.checkedInAt
    ) {
      updateData.checkedInAt = new Date();
    } else if (options?.checkedInAt !== undefined) {
      updateData.checkedInAt = options.checkedInAt;
    }

    if (
      newStatus === "INSTALLED" &&
      !currentItem.installedAt &&
      !options?.installedAt
    ) {
      updateData.installedAt = new Date();
    } else if (options?.installedAt !== undefined) {
      updateData.installedAt = options.installedAt;
    }

    if (options?.etaAt !== undefined) {
      updateData.etaAt = options.etaAt;
    }

    const item = await prisma.accessoryItem.update({
      where: { id: itemId },
      data: updateData,
    });

    // Create status change event
    await prisma.accessoryItemEvent.create({
      data: {
        itemId,
        type: "STATUS_CHANGE",
        fromStatus: currentItem.status,
        toStatus: newStatus,
        message: options?.note || `Status changed to ${newStatus}`,
        changedByUserId: userId,
      },
    });

    return item;
  } catch (error) {
    console.error("Error changing accessory item status:", error);
    throw new Error("Failed to change item status");
  }
}

// Add note to item
export async function addAccessoryItemNote(
  itemId: string,
  note: string,
  userId: string,
) {
  try {
    const event = await prisma.accessoryItemEvent.create({
      data: {
        itemId,
        type: "NOTE",
        message: note,
        changedByUserId: userId,
      },
    });

    return event;
  } catch (error) {
    console.error("Error adding note to accessory item:", error);
    throw new Error("Failed to add note");
  }
}

// Delete item (soft delete could be added later)
export async function deleteAccessoryItem(itemId: string, userId: string) {
  try {
    // Delete events first
    await prisma.accessoryItemEvent.deleteMany({
      where: { itemId },
    });

    // Then delete item
    await prisma.accessoryItem.delete({
      where: { id: itemId },
    });

    return { success: true };
  } catch (error) {
    console.error("Error deleting accessory item:", error);
    throw new Error("Failed to delete item");
  }
}

// Get all jobs for job selector
export async function getJobsForSelector(search?: string) {
  try {
    const where: any = {
      status: { in: ["ONGOING", "ON_HOLD"] },
    };

    if (search) {
      where.OR = [
        { jobName: { contains: search, mode: "insensitive" } },
        {
          customer: { displayName: { contains: search, mode: "insensitive" } },
        },
      ];
    }

    const jobs = await prisma.job.findMany({
      where,
      select: {
        id: true,
        jobNumber: true,
        jobName: true,
        status: true,
        customer: {
          select: {
            id: true,
            displayName: true,
            companyName: true,
            phone: true,
            email: true,
          },
        },
      },
      orderBy: { jobNumber: "desc" },
      take: 50,
    });

    return jobs;
  } catch (error) {
    console.error("Error fetching jobs:", error);
    throw new Error("Failed to fetch jobs");
  }
}

// Get item history/events
export async function getAccessoryItemEvents(itemId: string) {
  try {
    const events = await prisma.accessoryItemEvent.findMany({
      where: { itemId },
      include: {
        changedByUser: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return events;
  } catch (error) {
    console.error("Error fetching item events:", error);
    throw new Error("Failed to fetch item history");
  }
}

// Get summary stats for dashboard
export async function getAccessoryTrackerStats() {
  try {
    const totalTrackers = await prisma.accessoryTracker.count();

    const itemsByStatus = await prisma.accessoryItem.groupBy({
      by: ["status"],
      _count: true,
    });

    const needsAttention = await prisma.accessoryItem.count({
      where: {
        OR: [
          { status: "ISSUE" },
          {
            AND: [
              { etaAt: { lt: new Date() } },
              {
                status: {
                  notIn: ["DELIVERED", "CHECKED_IN", "INSTALLED", "NOT_NEEDED"],
                },
              },
            ],
          },
        ],
      },
    });

    return {
      totalTrackers,
      itemsByStatus,
      needsAttention,
    };
  } catch (error) {
    console.error("Error fetching stats:", error);
    throw new Error("Failed to fetch statistics");
  }
}
