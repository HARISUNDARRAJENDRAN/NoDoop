import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("valid email is required"),
  name: z.string().min(1, "name is required").max(120),
  password: z.string().min(8, "password must be at least 8 characters")
});

export const loginSchema = z.object({
  email: z.string().email("valid email is required"),
  password: z.string().min(1, "password is required")
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "refresh token is required")
});

export const createDocSchema = z.object({
  title: z.string().max(500).optional().default("Untitled document")
});

export const saveDocSchema = z.object({
  payloadBase64: z.string().min(1, "payloadBase64 is required"),
  parentVersionId: z.string().nullable().optional().default(null)
});

export const shareDocSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  role: z.enum(["editor", "viewer"], { message: "role must be editor or viewer" })
});

export const inviteDocSchema = z.object({
  email: z.string().email("valid email is required"),
  role: z.enum(["editor", "viewer"], { message: "role must be editor or viewer" })
});

export const updateCollaboratorRoleSchema = z.object({
  role: z.enum(["editor", "viewer"], { message: "role must be editor or viewer" })
});

export const transferOwnershipSchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, "invalid user id")
});

export const docPreferencesSchema = z
  .object({
    starred: z.boolean().optional(),
    pinned: z.boolean().optional()
  })
  .refine((value) => value.starred !== undefined || value.pinned !== undefined, {
    message: "at least one preference is required"
  });

export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "invalid id");
