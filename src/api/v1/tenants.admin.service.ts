import type { PrismaClient } from "@/../generated/prisma/client";
import basePrisma from "@/api/lib/prisma";
import { ConflictError, ForbiddenError, ProEditionError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy";
import { asSuperAdminOn } from "@/lib/tenancy/multi-tenant";
import type { TenantCreate, TenantDto, TenantUpdate } from "./tenants.service";
import { TENANT_SELECT, toDto } from "./tenants.service";

// Tenant mutation: create is available in the Free edition (multi-tenant management and the
// destructive operations require Pro). updateTenant and deleteTenant remain Pro-gated since they
// affect existing tenants and carry higher risk / infrastructure cost.

export async function updateTenant(
  _ctx: TenantContext,
  _id: bigint,
  _patch: TenantUpdate,
  _base?: PrismaClient,
): Promise<TenantDto> {
  throw new ProEditionError();
}

export async function createTenant(
  ctx: TenantContext,
  input: TenantCreate,
  base: PrismaClient = basePrisma,
): Promise<TenantDto> {
  // Only SUPER_ADMIN may provision tenants (the controller gates on requireRole too, but this
  // defense-in-depth keeps the service safe when called bypassing the HTTP layer, e.g. tests).
  if (ctx.role !== "SUPER_ADMIN") {
    throw new ForbiddenError();
  }
  // Check slug uniqueness before attempting the write.
  const existing = await asSuperAdminOn(base, (db) =>
    db.tenant.findUnique({ where: { slug: input.slug }, select: { id: true } }),
  );
  if (existing) {
    throw new ConflictError("Slug already in use", "errors.tenantSlugInUse");
  }

  const row = await asSuperAdminOn(base, (db) =>
    db.tenant.create({
      data: { name: input.name, slug: input.slug },
      select: TENANT_SELECT,
    }),
  );
  return toDto(row);
}

export async function deleteTenant(
  _ctx: TenantContext,
  _id: bigint,
  _base?: PrismaClient,
): Promise<void> {
  throw new ProEditionError();
}
