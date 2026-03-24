import { AppError } from "./AppError.js";

export function validate(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const messages = result.error.issues.map((i) => i.message).join("; ");
    throw new AppError(messages, 400, "VALIDATION_ERROR");
  }
  return result.data;
}
