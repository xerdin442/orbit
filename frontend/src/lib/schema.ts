import { z } from "zod";

const projectNameSchema = z
  .string()
  .min(3, "Project name must be at least 3 characters")
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    "Lowercase letters, numbers, and hyphens only",
  );

const healthCheckFieldsSchema = {
  healthCheck: z.boolean(),
  healthCheckPort: z.coerce.number().int().min(1).max(65535),
  healthCheckPath: z.string().min(1, "Enter a path"),
  healthCheckTimeout: z.coerce.number().int().min(1),
};

export const buildDirectorySchema = z
  .string()
  .optional()
  .refine((value) => !value || !value.split("/").includes(".."), {
    message: 'Build directory cannot contain ".." segments',
  });

const buildConfigFieldsSchema = {
  buildDirectory: buildDirectorySchema,
  startCommand: z.string().optional(),
};

export const configureProjectSchema = z.object({
  name: projectNameSchema,
  defaultBranch: z.string().min(1, "Select a branch"),
  ...healthCheckFieldsSchema,
  ...buildConfigFieldsSchema,
  envVars: z.array(z.object({ key: z.string(), value: z.string() })),
});

export type ConfigureProjectFormInput = z.input<typeof configureProjectSchema>;
export type ConfigureProjectFormOutput = z.output<
  typeof configureProjectSchema
>;

export const editProjectSchema = z.object({
  name: projectNameSchema,
  ...healthCheckFieldsSchema,
  ...buildConfigFieldsSchema,
});

export type EditProjectFormInput = z.input<typeof editProjectSchema>;
export type EditProjectFormOutput = z.output<typeof editProjectSchema>;

export const resourceNameSchema = z
  .string()
  .min(3, "Resource name must be at least 3 characters")
  .regex(/^[a-z]+(-[a-z]+)*$/, "Lowercase letters and hyphens only");

export const environmentNameSchema = z
  .string()
  .min(3, "Environment name must be at least 3 characters")
  .max(72, "Environment name is too long")
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    "Lowercase letters, numbers, and hyphens only",
  );

export const hostnameSchema = z
  .string()
  .min(3, "Enter a valid hostname")
  .max(253, "Hostname is too long")
  .regex(
    /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i,
    "Enter a valid domain, e.g. app.example.com",
  );

export type CredentialCategory =
  | "url"
  | "host"
  | "port"
  | "password"
  | "user"
  | "database";

const CREDENTIAL_CATEGORY_REQUIREMENT: Record<CredentialCategory, string> = {
  url: "URL or URI",
  host: "HOST",
  port: "PORT",
  password: "PASSWORD",
  user: "USER",
  database: "DATABASE or NAME",
};

export function classifyCredentialKey(key: string): CredentialCategory | null {
  const upper = key.toUpperCase();
  if (upper.includes("URL") || upper.includes("URI")) return "url";
  if (upper.includes("HOST")) return "host";
  if (upper.includes("PORT")) return "port";
  if (upper.includes("PASSWORD")) return "password";
  if (upper.includes("USER")) return "user";
  if (upper.includes("DATABASE") || upper.includes("NAME")) return "database";
  return null;
}

const CREDENTIAL_KEY_CHARSET = /^[A-Za-z0-9_]+$/;
const DIGIT_START = /^[0-9]/;

export function credentialKeySchema(defaultKey: string) {
  const category = classifyCredentialKey(defaultKey);

  return z
    .string()
    .min(1, "Key name is required")
    .regex(
      CREDENTIAL_KEY_CHARSET,
      "Key name must contain letters, digits, and underscores only",
    )
    .refine((value) => !DIGIT_START.test(value), {
      message: "Key name cannot start with a digit",
    })
    .refine((value) => classifyCredentialKey(value) === category, {
      message: category
        ? `Key name must contain ${CREDENTIAL_CATEGORY_REQUIREMENT[category]}`
        : "Not a recognized credential key",
    });
}
