// // utils/jwtUtils.js - Updated with cross-platform storage
// import { storage } from './storage';

// /**
//  * Decode JWT token payload (without verification - for display purposes only)
//  * @param {string} token - JWT token
//  * @returns {object|null} - Decoded payload or null if invalid
//  */
// export const decodeJWT = (token) => {
//   try {
//     if (!token) return null;
    
//     // JWT has 3 parts: header.payload.signature
//     const parts = token.split('.');
//     if (parts.length !== 3) return null;
    
//     // Decode the payload (middle part)
//     const payload = parts[1];
    
//     // Add padding if needed for base64 decoding
//     const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
    
//     // Decode base64 and parse JSON
//     const decodedPayload = JSON.parse(atob(paddedPayload));
    
//     return decodedPayload;
//   } catch (error) {
//     console.error('Error decoding JWT:', error);
//     return null;
//   }
// };

// /**
//  * Get current user data from stored JWT token
//  * @returns {Promise<object|null>} - User data or null if no valid token
//  */
// export const getCurrentUser = async () => {
//   try {
//     const token = await storage.getItem('access_token');
//     if (!token) return null;
    
//     const payload = decodeJWT(token);
//     if (!payload) return null;
    
//     // Check if token is expired
//     const currentTime = Math.floor(Date.now() / 1000);
//     if (payload.exp && payload.exp < currentTime) {
//       // Token expired, remove it
//       await storage.removeItem('access_token');
//       return null;
//     }
    
//     return {
//       username: payload.sub,
//       role: payload.role,
//       firstName: payload.first_name,
//       lastName: payload.last_name,
//       warehouseCode: payload.warehouse_code,
//       siteCode: payload.site_code,
//       fullName: `${payload.first_name} ${payload.last_name}`,
//       exp: payload.exp
//     };
//   } catch (error) {
//     console.error('Error getting current user:', error);
//     return null;
//   }
// };

// /**
//  * Check if current user has specific role
//  * @param {string} requiredRole - Role to check for (exact match)
//  * @returns {Promise<boolean>} - True if user has the role
//  */
// export const hasRole = async (requiredRole) => {
//   const user = await getCurrentUser();
//   if (!user || !user.role) return false;
  
//   // Exact match for your database roles: "Admin" and "SecurityGuard"
//   return user.role === requiredRole;
// };

// /**
//  * Check if user is admin
//  * @returns {Promise<boolean>} - True if user is admin
//  */
// export const isAdmin = async () => {
//   const user = await getCurrentUser();
//   if (!user || !user.role) return false;
  
//   const role = user.role;
//   // Check for exact match with your database role
//   return role === 'Admin';
// };

// /**
//  * Check if user is security guard
//  * @returns {Promise<boolean>} - True if user is security guard  
//  */
// export const isSecurityGuard = async () => {
//   const user = await getCurrentUser();
//   if (!user || !user.role) return false;
  
//   const role = user.role;
//   // Check for exact match with your database role
//   return role === 'SecurityGuard';
// };

// utils/jwtUtils.js - MERGED Multi-Role Support
import { storage } from './storage';

/**
 * Decode JWT token payload (without verification - for display purposes only)
 */
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

/**
 * Get current user data from stored JWT token with multi-role support
 */
export const getCurrentUser = async () => {
  try {
    const token = await storage.getItem('access_token');
    if (!token) return null;
    
    const payload = decodeJWT(token);
    if (!payload) return null;
    
    // Check if token is expired
    const currentTime = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < currentTime) {
      await storage.removeItem('access_token');
      return null;
    }
    
    // ✅ MERGED: Enhanced role processing with multi-role support
    let role = null;
    let roles = [];
    
    if (typeof payload.role === "string") {
      // Handle comma-separated roles: "Security Admin, IT Admin"
      if (payload.role.includes(',')) {
        roles = payload.role.split(',').map(r => r.trim().toLowerCase().replace(/\s+/g, ''));
        role = roles[0]; // Primary role
      } else {
        role = payload.role.toLowerCase().replace(/\s+/g, '');
        roles = [role];
      }
    } else if (Array.isArray(payload.role) && payload.role.length > 0) {
      roles = payload.role.map(r => r.toLowerCase().replace(/\s+/g, ''));
      role = roles[0]; // Primary role
    }
    
    return {
      username: payload.sub,
      role, // Primary role: securityadmin / securityguard / itadmin
      roles, // Array of all roles
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

/**
 * Check if current user has specific role
 */
export const hasRole = async (requiredRole) => {
  const user = await getCurrentUser();
  if (!user || !user.roles) return false;
  
  const normalizedRequired = requiredRole.toLowerCase().replace(/\s+/g, '');
  return user.roles.includes(normalizedRequired);
};

/**
 * Check if user is admin (Security Admin or IT Admin)
 */
export const isAdmin = async () => {
  const user = await getCurrentUser();
  if (!user || !user.roles) return false;
  
  return user.roles.includes('securityadmin') || user.roles.includes('itadmin');
};

/**
 * Check if user is security guard
 */
export const isSecurityGuard = async () => {
  return await hasRole('Security Guard');
};

/**
 * ✅ MERGED: Additional role check helpers
 */
export const isSecurityAdmin = async () => {
  return await hasRole('Security Admin');
};

export const isITAdmin = async () => {
  return await hasRole('IT Admin');
};