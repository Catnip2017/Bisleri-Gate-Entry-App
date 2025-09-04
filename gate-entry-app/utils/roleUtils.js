// utils/roleUtils.js
export const normalizeRoles = (rawRole) => {
  let roles = [];

  if (!rawRole) return new Set();

  if (Array.isArray(rawRole)) {
    roles = rawRole;
  } else if (typeof rawRole === "string") {
    try {
      const parsed = JSON.parse(rawRole);
      roles = Array.isArray(parsed) ? parsed : rawRole.split(",");
    } catch {
      roles = rawRole.split(",");
    }
  }

  return new Set(
    roles.map((r) => r.toString().toLowerCase().trim().replace(/\s+/g, ""))
  );
};
