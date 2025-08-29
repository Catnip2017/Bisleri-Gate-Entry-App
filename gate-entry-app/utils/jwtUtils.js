import { storage } from './storage';

export const decodeJWT = (token) => {
  try {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1];
    const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
    const decodedPayload = JSON.parse(atob(paddedPayload));
    return decodedPayload;
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
};

export const getCurrentUser = async () => {
  try {
    const token = await storage.getItem('access_token');
    if (!token) return null;

    const payload = decodeJWT(token);
    if (!payload) return null;

    const currentTime = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < currentTime) {
      await storage.removeItem('access_token');
      return null;
    }

    // ✅ Normalize role
    let role = null;
    if (typeof payload.role === "string") {
      role = payload.role.toLowerCase().replace(/\s+/g, "");
    } else if (Array.isArray(payload.role) && payload.role.length > 0) {
      role = payload.role[0].toLowerCase().replace(/\s+/g, "");
    }

    return {
      username: payload.sub,
      role,  // normalized: securityadmin / securityguard / itadmin
      firstName: payload.first_name,
      lastName: payload.last_name,
      warehouseCode: payload.warehouse_code,
      siteCode: payload.site_code,
      fullName: `${payload.first_name || ""} ${payload.last_name || ""}`.trim(),
      exp: payload.exp
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

// ✅ Role check helpers
export const hasRole = async (requiredRole) => {
  const user = await getCurrentUser();
  if (!user || !user.role) return false;
  return user.role === requiredRole.toLowerCase().replace(/\s+/g, "");
};

export const isSecurityAdmin = async () => {
  const user = await getCurrentUser();
  return user?.role === "securityadmin";
};

export const isSecurityGuard = async () => {
  const user = await getCurrentUser();
  return user?.role === "securityguard";
};

export const isITAdmin = async () => {
  const user = await getCurrentUser();
  return user?.role === "itadmin";
};
