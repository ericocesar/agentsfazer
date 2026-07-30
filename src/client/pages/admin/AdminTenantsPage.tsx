import { Loader, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate } from "react-router";
import {
  Badge,
  Button,
  Card,
  Input,
  Modal,
  Skeleton,
  useModalController,
} from "@/client/components";
import { useAuth } from "@/client/contexts/AuthContext";
import { api } from "@/client/lib/api";
import { formatDate } from "@/client/lib/utils";

// Single-tenant Tenants tab: lists the tenant created at /setup, read-only, with an upgrade gate
// where multi-tenant management would be. Creating and managing multiple tenants requires Pro.
type TenantsData = Awaited<
  ReturnType<typeof api.api.admin.tenants.get>
>["data"];
type TenantRow = NonNullable<TenantsData>["tenants"][number];

const TENANT_SKELETON_KEYS = ["tenant-0", "tenant-1", "tenant-2"];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export function AdminTenantsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const createModal = useModalController();

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.api.admin.tenants.get();
      if (data) setTenants(data.tenants);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTenants();
  }, [fetchTenants]);

  // The Tenants tab is fleet-level; a tenant admin has no business here.
  if (user && user.role !== "SUPER_ADMIN") {
    return <Navigate to="/admin/users" replace />;
  }

  return (
    <div className="space-y-6 pt-2">
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={createModal.open}>
          {t("admin.createTenant", "Create tenant")}
        </Button>
      </div>

      <Card>
        {loading ? (
          <div className="py-2" role="status">
            <span className="sr-only">{t("common.loading", "Loading…")}</span>
            {TENANT_SKELETON_KEYS.map((key) => (
              <div
                key={key}
                className="flex items-center gap-4 border-border/50 border-b px-2 py-3"
              >
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="ml-auto h-7 w-28 rounded" />
              </div>
            ))}
          </div>
        ) : tenants.length === 0 ? (
          <p className="py-10 text-center text-sm text-text-muted">
            {t("tenant.none", "No tenants yet.")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-border border-b text-left">
                  <th className="px-2 py-3 font-medium text-text-secondary">
                    {t("tenant.name", "Name")}
                  </th>
                  <th className="px-2 py-3 font-medium text-text-secondary">
                    {t("tenant.slug", "Slug")}
                  </th>
                  <th className="px-2 py-3 font-medium text-text-secondary">
                    {t("admin.users", "Users")}
                  </th>
                  <th className="px-2 py-3 font-medium text-text-secondary">
                    {t("admin.createdAt", "Created")}
                  </th>
                  <th className="px-2 py-3 font-medium text-text-secondary">
                    {t("admin.actions", "Actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr
                    key={tenant.id}
                    className="border-border/50 border-b hover:bg-bg-tertiary/50"
                  >
                    <td className="px-2 py-3 text-text-primary">
                      <span className="flex items-center gap-2">
                        {tenant.name}
                        {tenant.demoMode && (
                          <Badge variant="secondary">
                            {t("tenant.demo", "Demo")}
                          </Badge>
                        )}
                      </span>
                    </td>
                    <td className="px-2 py-3 font-mono text-text-secondary text-xs">
                      {tenant.slug}
                    </td>
                    <td className="px-2 py-3 text-text-secondary">
                      {tenant.userCount}
                    </td>
                    <td className="px-2 py-3 text-text-secondary">
                      {formatDate(tenant.createdAt)}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-1">
                        <Link
                          to={`/admin/users?tenant=${tenant.id}`}
                          className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 font-medium text-text-secondary text-xs transition-colors hover:bg-bg-hover hover:text-text-primary"
                        >
                          <Users className="h-3.5 w-3.5" aria-hidden="true" />
                          {t("admin.viewUsers", "View users")}
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CreateTenantModal
        modal={createModal}
        onCreated={fetchTenants}
      />
    </div>
  );
}

function CreateTenantModal({
  modal,
  onCreated,
}: {
  modal: ReturnType<typeof useModalController>;
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);

  // Auto-fill slug from name until the user manually edits the slug field.
  const handleNameChange = useCallback(
    (value: string) => {
      setName(value);
      if (!slugTouched) {
        setSlug(slugify(value));
      }
    },
    [slugTouched],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!name.trim() || !slug.trim()) return;
      setSubmitting(true);
      try {
        const { error: err } = await api.api.v1.tenants.post({
          name: name.trim(),
          slug: slug.trim(),
          adminEmail: adminEmail.trim() || undefined,
        });
        if (err) {
          setError(
            err.value === "Slug already in use"
              ? t("errors.tenantSlugInUse", "This slug is already in use")
              : typeof err.value === "string"
                ? err.value
                : t("common.error", "An error occurred"),
          );
          return;
        }
        setName("");
        setSlug("");
        setAdminEmail("");
        setSlugTouched(false);
        modal.close();
        onCreated();
      } finally {
        setSubmitting(false);
      }
    },
    [name, slug, adminEmail, modal, onCreated, t],
  );

  return (
    <Modal
      modal={modal}
      title={t("admin.createTenant", "Create tenant")}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="tenant-name"
            className="font-medium text-text-primary text-sm"
          >
            {t("tenant.name", "Name")}
          </label>
          <Input
            id="tenant-name"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder={t("tenant.namePlaceholder", "My Company")}
            required
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="tenant-slug"
            className="font-medium text-text-primary text-sm"
          >
            {t("tenant.slug", "Slug")}
          </label>
          <Input
            id="tenant-slug"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
            placeholder={t("tenant.slugPlaceholder", "my-company")}
            required
            pattern="^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$"
          />
          <p className="text-text-muted text-xs">
            {t(
              "tenant.slugHint",
              "URL-safe identifier. Lowercase letters, numbers, and hyphens only.",
            )}
          </p>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="tenant-admin-email"
            className="font-medium text-text-primary text-sm"
          >
            {t("admin.adminEmail", "Admin email")}
            <span className="ml-1 text-text-muted">
              {t("common.optional", "(optional)")}
            </span>
          </label>
          <Input
            id="tenant-admin-email"
            type="email"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            placeholder={t("admin.adminEmailPlaceholder", "admin@example.com")}
          />
          <p className="text-text-muted text-xs">
            {t(
              "tenant.adminEmailHint",
              "If provided, an invite for the first TENANT_ADMIN is sent automatically.",
            )}
          </p>
        </div>

        {error && (
          <p className="rounded-lg border border-error bg-error-soft px-3 py-2 text-sm text-error">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="secondary"
            type="button"
            onClick={() => modal.close()}
            disabled={submitting}
          >
            {t("common.cancel", "Cancel")}
          </Button>
          <Button type="submit" loading={submitting}>
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader className="h-4 w-4 animate-spin" aria-hidden="true" />
                {t("common.creating", "Creating…")}
              </span>
            ) : (
              t("admin.createTenant", "Create tenant")
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
