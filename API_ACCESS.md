# GMD Portal – External API (v1)

Read-only JSON API for trusted outside programs. Keys are created by a portal
admin in **Settings → API Keys**.

## Authentication

Send the key on every request:

```
Authorization: Bearer gmd_live_xxxxxxxxxxxxxxxx
```

(`X-API-Key: <key>` also works.)

- Keys are **server-side only** — never put one in browser/mobile code. CORS is
  not enabled on these endpoints.
- Each key only sees the programs it was granted (scopes). Dollar amounts are
  hidden unless the key has the **Include pricing** scope.
- A revoked or expired key gets `401`. A key missing a scope gets `403`.

| Scope | Unlocks |
| --- | --- |
| `fabrication-orders:read` | `/api/v1/fabrication-orders*` |
| `accessories:read` | `/api/v1/accessories/items` |
| `pricing:read` | Adds `pricing` / `total` fields to the responses above |

## Conventions

- All dates are ISO 8601 (UTC).
- List endpoints are paginated: `limit` (default 50, max 200) and `cursor`.
  Pass the previous response's `nextCursor` as `cursor`; `nextCursor: null`
  means you have everything.
- List results are ordered by `updatedAt` ascending. To sync, remember the
  newest `updatedAt` you've processed and pass it as `updatedSince` next time.
- Errors: `{ "error": "message" }` with status 400 / 401 / 403 / 404 / 500.

## Endpoints

### `GET /api/v1/ping`

Confirms the key works.

```json
{ "ok": true, "keyName": "Jobsite AI", "scopes": ["accessories:read"], "serverTime": "..." }
```

### `GET /api/v1/fabrication-orders`

Countertop layout per sale. Active orders only unless `includeArchived=true`.

| Param | Description |
| --- | --- |
| `updatedSince` | ISO date — orders changed at/after this time |
| `jobNumber` | Portal job number |
| `jobId` | Portal job id |
| `dealId` | Pipedrive deal id |
| `search` | Client name, order number or deal name |
| `includeArchived` | `true` to include archived orders |
| `limit`, `cursor` | Pagination |

```json
{
  "data": [
    {
      "id": "clx...",
      "orderNumber": "FO2609004",
      "date": "2026-09-18T00:00:00.000Z",
      "isArchived": false,
      "clientName": "Jane Smith",
      "salesRep": "Carlos",
      "notes": null,
      "pipedriveDealId": "1234",
      "dealName": "Smith Kitchen",
      "job": {
        "id": "…", "jobNumber": 812, "jobName": "Smith Kitchen", "status": "ONGOING",
        "propertyAddress": "12 Palm Ave, Miami, FL",
        "customer": { "id": "…", "name": "Jane Smith" }
      },
      "createdBy": "Carlos",
      "totalSqft": 64.5,
      "areaCount": 2,
      "areas": [
        {
          "id": "…",
          "name": "Kitchen",
          "stone": {
            "name": "Calacatta Gold", "thickness": "3cm", "supplier": "MSI",
            "slabType": "Vein", "slabQty": 2, "slabRecommendedQty": 2,
            "slabAreaLabel": "1) 127 X 64 = 50.80", "warehouseNumber": "WH-221"
          },
          "sink": { "type": "Undermount", "model": "Kraus 32\"", "qty": 1, "faucet": "Client provides" },
          "backsplash": { "has": true, "heightIn": 4 },
          "sqft": 52.3,
          "sections": [
            { "id": "…", "label": "Perimeter", "edge": "Eased", "buildUp": null, "sqft": 38.1 }
          ],
          "cutoutsAndExtras": {
            "sinkCutout": { "option": "Undermount", "qty": 1 },
            "cooktopCutout": null, "bumpOut": null, "cuttingBoard": null,
            "windowsill": null, "powerStation": null, "otherCharge": null,
            "removal": "Laminate removal"
          },
          "leftover": "Client"
        }
      ],
      "createdAt": "…",
      "updatedAt": "…"
    }
  ],
  "total": 1,
  "nextCursor": null
}
```

### `GET /api/v1/fabrication-orders/{id}`

`{id}` = order id or order number (e.g. `FO2609004`). Same shape as above,
plus for each area:

- `sections[].pieces[]` — every measured piece: `lengthIn`, `widthIn`, `sqft`
- `drawing` — `{ mode: "CANVAS" | "IMAGE", canvasData }` (the layout sketch)
- `images[]` — `{ id, url, caption, uploadedAt }` (public image URLs)

### `GET /api/v1/accessories/items`

One row per accessory item, with its job and tracker attached. Archived
items/trackers are excluded unless `includeArchived=true`.

| Param | Description |
| --- | --- |
| `status` | One or more, comma-separated (see below) |
| `updatedSince` | ISO date — items changed at/after this time |
| `jobNumber` / `jobId` | Filter to one job |
| `trackerId` | Filter to one tracker |
| `department` | `CABINETS`, `COUNTERTOPS` or `BOTH` |
| `includeArchived` | `true` to include archived |
| `limit`, `cursor` | Pagination |

Statuses, in workflow order: `PENDING_REMEASURE_APPROVAL`, `READY_TO_ORDER`,
`ORDERED`, `IN_TRANSIT`, `DELIVERED`, `CHECKED_IN`, `INSTALLED`, plus
`NOT_NEEDED` and `ISSUE`.

**Ready for jobsite:** the team marks a package as ready to be taken to the
jobsite with status `DELIVERED`. Each item also has a `readyForJobsite`
boolean, so you can rely on that flag instead of the status name.

```json
{
  "data": [
    {
      "id": "…",
      "name": "Blum soft-close hinge",
      "category": "HARDWARE",
      "quantity": 12,
      "sku": "71B3550",
      "vendor": "Richelieu",
      "status": "DELIVERED",
      "statusLabel": "Delivered",
      "readyForJobsite": true,
      "priority": "NORMAL",
      "isArchived": false,
      "assignedTo": "Luis",
      "dates": {
        "ordered": "…", "eta": "…", "delivered": "…", "checkedIn": null,
        "installed": null, "lastStatusChange": "…"
      },
      "tracker": {
        "id": "…", "invoiceNumber": "INV-1043", "department": "CABINETS",
        "notes": null, "remeasureApprovedAt": "…", "isArchived": false
      },
      "job": {
        "id": "…", "jobNumber": 812, "jobName": "Smith Kitchen", "status": "ONGOING",
        "propertyAddress": "12 Palm Ave, Miami, FL", "customer": "Jane Smith"
      },
      "createdAt": "…",
      "updatedAt": "…"
    }
  ],
  "total": 1,
  "nextCursor": null
}
```

Typical to-do sync: poll every few minutes with
`?status=DELIVERED&updatedSince=<last seen updatedAt>` to add items to the
worker's to-do list. To know when to remove them, also poll without `status`
(just `updatedSince`) and drop any item whose `readyForJobsite` is now
`false` (e.g. moved on to `CHECKED_IN` / `INSTALLED`, or marked `NOT_NEEDED`).

## Example

```bash
curl -H "Authorization: Bearer $GMD_API_KEY" \
  "https://<portal-domain>/api/v1/fabrication-orders?jobNumber=812"
```
