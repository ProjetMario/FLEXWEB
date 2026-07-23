import type { UserRole } from "@prisma/client";

export type { UserRole };

export interface TenantContext {
  organizationId: string;
  slug: string;
  isCustomDomain: boolean;
  domain?: string;
}

export type Permission =
  | "organizations:read"
  | "organizations:create"
  | "organizations:update"
  | "organizations:delete"
  | "users:invite"
  | "users:manage"
  | "websites:manage"
  | "pages:manage"
  | "pages:publish"
  | "content:manage"
  | "media:manage"
  | "forms:read"
  | "domains:manage"
  | "subscriptions:read"
  | "subscriptions:manage"
  | "settings:manage"
  | "audit:read"
  | "templates:manage";

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: [
    "organizations:read",
    "organizations:create",
    "organizations:update",
    "organizations:delete",
    "users:invite",
    "users:manage",
    "websites:manage",
    "pages:manage",
    "pages:publish",
    "content:manage",
    "media:manage",
    "forms:read",
    "domains:manage",
    "subscriptions:manage",
    "settings:manage",
    "audit:read",
    "templates:manage",
  ],
  ADMIN: [
    "organizations:read",
    "organizations:update",
    "users:invite",
    "users:manage",
    "websites:manage",
    "pages:manage",
    "pages:publish",
    "content:manage",
    "media:manage",
    "forms:read",
    "domains:manage",
    "subscriptions:read",
    "settings:manage",
  ],
  EDITOR: [
    "organizations:read",
    "pages:manage",
    "content:manage",
    "media:manage",
    "forms:read",
  ],
};
