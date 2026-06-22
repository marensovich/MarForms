import { apiRequest } from "./client";
import type { FormAnswers } from "../types/forms";

// --- Forms ---
export interface DashboardForm {
  id: string;
  title: string;
  active: boolean;
  submissionCount: number;
  createdAt: string;
}

export interface CreateFormPayload {
  serverId: number;
  channelsIds?: number[];
  schema: {
    title: string;
    description: string;
    fields: unknown[];
  };
}

export function getDashboardForms(page = 0, size = 20): Promise<PageResponse<DashboardForm>> {
  return apiRequest(`/forms?page=${page}&size=${size}`);
}

export function createForm(payload: CreateFormPayload): Promise<DashboardForm> {
  return apiRequest("/forms", { method: "POST", body: payload });
}

export function toggleFormActive(formId: string, active: boolean): Promise<DashboardForm> {
  return apiRequest(`/forms/${formId}`, { method: "PUT", body: { active } });
}

export function deleteForm(formId: string): Promise<void> {
  return apiRequest(`/forms/${formId}`, { method: "DELETE" });
}

// --- Submissions ---
export interface DashboardSubmission {
  id: string;
  formId: string;
  discordId: string;
  createdAt: string;
  answers: FormAnswers;
}

export function getFormSubmissions(
  formId: string,
  page = 0,
  size = 20
): Promise<PageResponse<DashboardSubmission>> {
  return apiRequest(`/forms/${formId}/submissions?page=${page}&size=${size}`);
}

// --- Users ---
export interface DashboardUser {
  id: number;
  discordId: string;
  discordUsername: string;
  roles: string[];
  bannedPermanently: boolean;
  bannedUntil: string | null;
}

export function getUsers(page = 0, size = 20): Promise<PageResponse<DashboardUser>> {
  return apiRequest(`/admin/users?page=${page}&size=${size}`);
}

export function assignUserRoles(discordId: string, roleIds: string[]): Promise<DashboardUser> {
  return apiRequest(`/admin/users/${discordId}/roles`, {
    method: "PUT",
    body: { roleIds },
  });
}

export function banUser(
  discordId: string,
  payload: { permanent: boolean; timeoutMinutes?: number }
): Promise<DashboardUser> {
  return apiRequest(`/admin/users/${discordId}/ban`, {
    method: "POST",
    body: payload,
  });
}

export function unbanUser(discordId: string): Promise<DashboardUser> {
  return apiRequest(`/admin/users/${discordId}/unban`, { method: "POST" });
}

// --- Roles ---
export interface DashboardRole {
  id: string;
  name: string;
  permissions: string[];
}

export function getRoles(): Promise<DashboardRole[]> {
  return apiRequest("/roles");
}

export function createRole(payload: {
  name: string;
  permissions: string[];
}): Promise<DashboardRole> {
  return apiRequest("/roles", { method: "POST", body: payload });
}

export function deleteRole(roleId: string): Promise<void> {
  return apiRequest(`/roles/${roleId}`, { method: "DELETE" });
}

// --- Shared ---
export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
}