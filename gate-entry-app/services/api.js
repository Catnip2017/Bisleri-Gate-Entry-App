// services/api.js - MERGED Complete API Suite
import axios from 'axios';
import { storage } from '../utils/storage';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { getCurrentUser } from '../utils/jwtUtils';
import { router } from 'expo-router';

// API URL is set in .env as EXPO_PUBLIC_API_URL
// Server  : EXPO_PUBLIC_API_URL=https://123.63.20.237:19000/api  (through Nginx)
// Local   : EXPO_PUBLIC_API_URL=http://YOUR_LOCAL_IP:8000        (direct to backend)
const getApiUrl = () => {
  return process.env.EXPO_PUBLIC_API_URL;
};

export const API_BASE_URL = getApiUrl();

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await storage.getItem('access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.warn('Failed to get auth token:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Handle 401 (session expired) — but NOT for the login endpoint itself
    if (error.response?.status === 401 && !error.config?.url?.includes('/login')) {
      try {
        await storage.removeItem('access_token');
        // Set a flag so LoginScreen can show the "session expired" message
        await storage.setItem('session_expired', 'true');
      } catch (storageError) {
        console.warn('Failed to clear auth token:', storageError);
      }
      // Redirect to login screen
      try {
        router.replace('/');
      } catch (navError) {
        console.warn('Navigation failed:', navError);
      }
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  login: async (credentials) => {
    const response = await api.post('/login', credentials);
    return response.data;
  },
  
  logout: async () => {
    try {
      const response = await api.post('/logout');
      await storage.removeItem('access_token');
      return response.data;
    } catch (error) {
      await storage.removeItem('access_token');
      throw error;
    }
  },
};

// ✅ MERGED: Complete Gate APIs with all features
export const gateAPI = {
  searchRecentDocuments: async (vehicleNo) => {
    if (!vehicleNo?.trim()) {
      throw new Error('Vehicle number is required');
    }
    const response = await api.get(`/search-recent-documents/${vehicleNo.trim()}`);
    return response.data;
  },

  getVehicleStatus: async (vehicleNo) => {
    if (!vehicleNo?.trim()) {
      throw new Error('Vehicle number is required');
    }
    const response = await api.get(`/vehicle-status/${vehicleNo.trim()}`);
    return response.data;
  },

  createBatchGateEntry: async (batchData) => {
    if (!batchData.vehicle_no?.trim()) {
      throw new Error('Vehicle number is required');
    }
    if (!batchData.document_nos || batchData.document_nos.length === 0) {
      throw new Error('At least one document must be selected');
    }
    const response = await api.post('/batch-gate-entry', batchData);
    return response.data;
  },

  createEnhancedBatchGateEntry: async (enhancedBatchData) => {
    if (!enhancedBatchData.vehicle_no?.trim()) {
      throw new Error('Vehicle number is required');
    }
    if (!enhancedBatchData.document_nos || enhancedBatchData.document_nos.length === 0) {
      throw new Error('At least one document must be selected');
    }
          // ✅ ADD: loader_count to integer if present (use isNaN check so 0 is preserved, not converted to null)
  if (enhancedBatchData.loader_count !== undefined && enhancedBatchData.loader_count !== null && enhancedBatchData.loader_count !== '') {
    const parsed = parseInt(enhancedBatchData.loader_count);
    enhancedBatchData.loader_count = isNaN(parsed) ? null : parsed;
  }
    const response = await api.post('/enhanced-batch-gate-entry', enhancedBatchData);
    return response.data;
  },

  createMultiDocumentManualEntry: async (multiEntryData) => {
    if (!multiEntryData.vehicle_no?.trim()) {
      throw new Error('Vehicle number is required');
    }
    if (multiEntryData.no_of_documents < 0) {
      throw new Error('Number of documents must be at least 0');
    }
          // ✅ ADD: Convert loader_count to integer (use isNaN check so 0 is preserved, not converted to null)
  if (multiEntryData.loader_count !== undefined && multiEntryData.loader_count !== null && multiEntryData.loader_count !== '') {
    const parsed = parseInt(multiEntryData.loader_count);
    multiEntryData.loader_count = isNaN(parsed) ? null : parsed;
  }
    const response = await api.post('/multi-document-manual-entry', multiEntryData);
    return response.data;
  },

  // getUnassignedDocuments: async (vehicleNo, hoursBack = 8) => {
  //   if (!vehicleNo?.trim()) {
  //     throw new Error('Vehicle number is required');
  //   }
  //   const response = await api.get(`/unassigned-documents/${vehicleNo.trim()}?hours_back=${hoursBack}`);
  //   return response.data;
  // },
  getUnassignedDocuments: async (vehicleNo, hoursBack = 144) => {  // ✅ CHANGED: 8 → 144
  if (!vehicleNo?.trim()) {
    throw new Error('Vehicle number is required');
  }
  const response = await api.get(`/unassigned-documents/${vehicleNo.trim()}?hours_back=${hoursBack}`);
  return response.data;
},

  assignDocumentToManualEntry: async (assignmentData) => {
    if (!assignmentData.insights_id || !assignmentData.document_no) {
      throw new Error('Both insights_id and document_no are required');
    }
    const response = await api.post('/assign-document-to-manual-entry', assignmentData);
    return response.data;
  },

  createGateEntry: async (entryData) => {
    const response = await api.post('/gate-entry', entryData);
    return response.data;
  },
};

// ✅ MERGED: Complete Insights APIs
export const insightsAPI = {
  getFilteredMovements: async (filters) => {
    const filterData = {
      from_date: filters.from_date,
      to_date: filters.to_date,
      site_code: filters.site_code || null,
      warehouse_code: filters.warehouse_code || null,
      movement_type: filters.movement_type || null,
      vehicle_no: filters.vehicle_no || null,
    };
    const response = await api.post('/filtered-movements', filterData);
    return response.data;
  },

  updateOperationalData: async (editData) => {
    if (!editData.gate_entry_no) {
      throw new Error('Gate entry number is required');
    }
    const response = await api.put('/update-operational-data', editData);
    return response.data;
  },

  getEditStatistics: async () => {
    const response = await api.get('/edit-statistics');
    return response.data;
  },
};

// ✅ MERGED: Complete Admin APIs
export const adminAPI = {
  registerUser: async (userData) => {
    const response = await api.post("/register", userData);
    return response.data;
  },

  resetPassword: async (resetData) => {
    const response = await api.post("/reset-password", resetData);
    return response.data;
  },

  modifyUser: async (username, data) => {
    const response = await api.put(`/modify-user/${username}`, data);
    return response.data;
  },
  updateUser: async (username, data) => {
  const response = await api.put(`/users/${username}/update`, data);
  return response.data;
},


  deleteUser: async (username) => {
    const response = await api.delete(`/user/${username}/delete`);
    return response.data;
  },

getAdminDashboardStats: async (filters = {}) => {
    const params = new URLSearchParams();
    
    if (filters.site_code) params.append('site_code', filters.site_code);
    if (filters.warehouse_code) params.append('warehouse_code', filters.warehouse_code);
    if (filters.from_date) params.append('from_date', filters.from_date);
    if (filters.to_date) params.append('to_date', filters.to_date);
    
    const url = params.toString() ? `/admin-dashboard-stats?${params}` : '/admin-dashboard-stats';
    const response = await api.get(url);
    return response.data;
  },
  getWarehouses: async () => {
    const response = await api.get("/warehouses");
    return response.data;
  },

  getAdminInsights: async (filters) => {
    const response = await api.post('/filtered-movements', filters);
    return response.data;
  },
  searchUsers: async (query) => {
    const response = await api.get(`/search-users`, { params: { q: query } });
    return response.data;
  },

 getAdminRMInsights: async (filters) => {
    const response = await api.post('/rm/filtered-entries', filters);
    return response.data;
  },


 getAdminRMStatistics: async (filters = {}) => {
    const params = new URLSearchParams();
    
    if (filters.site_code) params.append('site_code', filters.site_code);
    if (filters.warehouse_code) params.append('warehouse_code', filters.warehouse_code);
    if (filters.from_date) params.append('from_date', filters.from_date);
    if (filters.to_date) params.append('to_date', filters.to_date);
    
    // const url = params.toString() ? `/admin-rm-statistics?${params}` : '/rm/statistics';
    const url = params.toString() ? `/rm/statistics?${params}` : '/rm/statistics';

    const response = await api.get(url);
    return response.data;
  },

   getCombinedStats: async (filters = {}) => {
    try {
      const [fgStats, rmStats] = await Promise.all([
        adminAPI.getAdminDashboardStats(filters),
        rmAPI.getRMStatistics()
      ]);
      
      return {
        fg: fgStats,
        rm: rmStats,
        combined: {
          total_entries: (fgStats.total_movements || 0) + (rmStats.total_entries || 0),
          unique_vehicles: Math.max(fgStats.unique_vehicles || 0, rmStats.unique_vehicles || 0),
          gate_in_total: (fgStats.gate_in || 0) + (rmStats.gate_in_count || 0),
          gate_out_total: (fgStats.gate_out || 0) + (rmStats.gate_out_count || 0)
        }
      };
    } catch (error) {
      console.error('Error getting combined stats:', error);
      return null;
    }
  }

};


// ✅ MERGED: Complete RM APIs from main branch
export const rmAPI = {
  createRMEntry: async (entryData) => {
    if (!entryData.vehicle_no?.trim()) {
      throw new Error('Vehicle number is required');
    }
    if (!entryData.document_no?.trim()) {
      throw new Error('Document number is required');
    }
    if (!entryData.name_of_party?.trim()) {
      throw new Error('Name of Party is required');
    }
    if (!entryData.description_of_material?.trim()) {
      throw new Error('Description of Material is required');
    }
    if (!entryData.quantity?.trim()) {
      throw new Error('Quantity is required');
    }
    
    const response = await api.post('/rm/create-entry', entryData);
    return response.data;
  },

 getAdminFilteredRMEntries: async (filters) => {
    const response = await api.post('/rm/admin-filtered-entries', filters);
    return response.data;
  },

  // Enhanced regular filtered entries (keeping backward compatibility)
  getFilteredRMEntries: async (filters) => {
    // For admin users, use admin endpoint; for regular users, use regular endpoint
    try {
      const currentUser = await getCurrentUser();
      if (currentUser && (currentUser.roles?.includes('itadmin') || currentUser.roles?.includes('securityadmin'))) {
        return await rmAPI.getAdminFilteredRMEntries(filters);
      }
    } catch (error) {
      console.log('User check failed, using regular endpoint');
    }
    
    // Regular user endpoint
    const filterData = {
      from_date: filters.from_date,
      to_date: filters.to_date,
      vehicle_no: filters.vehicle_no || null,
      movement_type: filters.movement_type || null
    };
    const response = await api.post('/rm/filtered-entries', filterData);
    return response.data;
  },

  updateRMEntry: async (editData) => {
    if (!editData.gate_entry_no) {
      throw new Error('Gate entry number is required');
    }
    const response = await api.put('/rm/update-entry', editData);
    return response.data;
  },

  getRMStatistics: async () => {
    const response = await api.get('/rm/statistics');
    return response.data;
  }
};

// ✅ MERGED: All utility functions from main branch
export const documentAssignmentUtils = {
  needsDocumentAssignment: (record) => {
    return record.document_type === "Manual Entry - Pending Assignment" ||
           (record.document_type === "Manual Entry" && !record.document_date);
  },

  canAssignDocument: (record) => {
    return documentAssignmentUtils.needsDocumentAssignment(record) &&
           record.edit_status !== 'expired';
  }
};

export const editStatusUtils = {
  getButtonConfig: (record) => {
    if (!record.edit_button_config) {
      return editStatusUtils.calculateButtonConfig(record);
    }
    return record.edit_button_config;
  },

  isOperationalDataComplete: (record) => {
    return !!(
      record.driver_name && record.driver_name.trim() &&
      record.km_reading && record.km_reading.trim() &&
      record.loader_names && record.loader_names.trim()
    );
  },

  sortByEditPriority: (records) => {
    return records.sort((a, b) => {
      const configA = editStatusUtils.getButtonConfig(a);
      const configB = editStatusUtils.getButtonConfig(b);
      
      const priorityA = editStatusUtils.getPriorityValue(configA);
      const priorityB = editStatusUtils.getPriorityValue(configB);
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      const timeA = editStatusUtils.getTimeSinceCreation(a);
      const timeB = editStatusUtils.getTimeSinceCreation(b);
      return timeB - timeA;
    });
  },

  getPriorityValue: (buttonConfig) => {
    const priorityMap = { 'high': 1, 'medium': 2, 'none': 3 };
    return priorityMap[buttonConfig.priority] || 4;
  },

  getTimeSinceCreation: (record) => {
    try {
      const recordDateTime = new Date(`${record.date}T${record.time}`);
      return Date.now() - recordDateTime.getTime();
    } catch (error) {
      return Infinity;
    }
  },

  calculateButtonConfig: (record) => {
    const timeSinceCreation = editStatusUtils.getTimeSinceCreation(record);
    const isWithin48Hours = timeSinceCreation <= 48 * 60 * 60 * 1000;
    const isOperationalComplete = editStatusUtils.isOperationalDataComplete(record);

    if (!isWithin48Hours) {
      return {
        color: 'black',
        text: '⚫ Expired',
        enabled: false,
        priority: 'none',
        action: 'view_only'
      };
    }

    if (!record.can_edit) {
      return {
        color: 'gray',
        text: '🚫 No Access',
        enabled: false,
        priority: 'none',
        action: 'no_access'
      };
    }

    if (!isOperationalComplete) {
      return {
        color: 'yellow',
        text: '⚠️ Complete Info',
        enabled: true,
        priority: 'high',
        action: 'complete_required'
      };
    }

    return {
      color: 'green',
      text: '✅ Edit Details',
      enabled: true,
      priority: 'medium',
      action: 'edit_optional'
    };
  }
};

export const validationAPI = {
  getGateSequenceError: (vehicleStatus, requestedGateType) => {
    if (!vehicleStatus || vehicleStatus.status === "no_history") {
      if (requestedGateType === "Gate-Out") {
        return "First entry for this vehicle must be Gate-In";
      }
      return null;
    }

    if (requestedGateType === "Gate-In" && !vehicleStatus.can_gate_in) {
      return `Vehicle already has Gate-In (${vehicleStatus.last_movement.date}). Must do Gate-Out first.`;
    }

    if (requestedGateType === "Gate-Out" && !vehicleStatus.can_gate_out) {
      return `Vehicle already has Gate-Out (${vehicleStatus.last_movement.date}). Must do Gate-In first.`;
    }

    return null;
  }
};

export const gateHelpers = {
  isEmptyVehicle: (searchResults) => {
    return !searchResults || searchResults.count === 0;
  },

  formatSuccessMessage: (result, isManual = false) => {
    if (isManual) {
      return `Manual ${result.movement_type} completed successfully!\nGate Entry No: ${result.gate_entry_no}\nVehicle: ${result.vehicle_no}`;
    }

    return `${result.movement_type} completed successfully!\nProcessed: ${result.records_processed}/${result.total_requested} documents\nGate Entry No: ${result.gate_entry_no}`;
  }
};

export const handleAPIError = (error) => {
  // ── Network / connectivity errors ──────────────────────────────────────────
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return "Request timed out. The server is taking too long — please try again.";
  }
  if (!error.response && error.request) {
    return "Cannot reach the server. Please check your internet connection.";
  }

  // ── Client/local errors (thrown before the request) ───────────────────────
  if (!error.response && !error.request && error.message) {
    return error.message;
  }

  if (error.response) {
    const status = error.response.status;
    const detail = error.response.data?.detail || "";

    switch (status) {
      // ── 400 Bad Request ────────────────────────────────────────────────────
      case 400:
        if (detail.toLowerCase().includes('already has gate')) {
          return detail; // Gate sequence error — return backend message as-is
        }
        if (detail.toLowerCase().includes('already registered') ||
            detail.toLowerCase().includes('already exists') ||
            detail.toLowerCase().includes('duplicate')) {
          return detail || "This entry already exists. Please check for duplicates.";
        }
        if (detail.toLowerCase().includes('passwords do not match')) {
          return "Passwords do not match. Please re-enter your new password.";
        }
        return detail || "Invalid request. Please check your input and try again.";

      // ── 401 Unauthorised ──────────────────────────────────────────────────
      case 401:
        // Login-specific: server returns "Incorrect username or password"
        if (detail.toLowerCase().includes('incorrect') ||
            detail.toLowerCase().includes('username') ||
            detail.toLowerCase().includes('password')) {
          return "Incorrect username or password. Please try again.";
        }
        // User not found during login
        if (detail.toLowerCase().includes('user not found') ||
            detail.toLowerCase().includes('does not exist')) {
          return "Username not found. Please check your username.";
        }
        // Session / token expired (reached from authenticated routes)
        return "Session expired. Please login again.";

      // ── 403 Forbidden ────────────────────────────────────────────────────
      case 403:
        if (detail.toLowerCase().includes('edit window') ||
            detail.toLowerCase().includes('48 hour')) {
          return "Edit window expired. Records can only be edited within 48 hours of creation.";
        }
        if (detail.toLowerCase().includes('warehouse') ||
            detail.toLowerCase().includes('outside your')) {
          return "Access denied. You can only manage records for your assigned warehouse.";
        }
        return "Access denied. You do not have permission to perform this action.";

      // ── 404 Not Found ────────────────────────────────────────────────────
      case 404:
        if (detail.toLowerCase().includes('user')) {
          return "User not found. Please check the username and try again.";
        }
        if (detail.toLowerCase().includes('warehouse')) {
          return "Warehouse not found. Please check the warehouse code.";
        }
        if (detail.toLowerCase().includes('document')) {
          return "No matching documents found for this vehicle.";
        }
        return detail || "Record not found.";

      // ── 409 Conflict ─────────────────────────────────────────────────────
      case 409:
        return detail || "Duplicate entry. A record with these details already exists.";

      // ── 422 Unprocessable Entity ──────────────────────────────────────────
      case 422:
        return "Invalid input format. Please check all fields and try again.";

      // ── 500 Internal Server Error ─────────────────────────────────────────
      case 500:
        if (detail.toLowerCase().includes('database') ||
            detail.toLowerCase().includes('migration') ||
            detail.toLowerCase().includes('column')) {
          return "Database setup incomplete. Please contact IT support to run migrations.";
        }
        return "Server error. Please try again. If this persists, contact IT support.";

      // ── Other ─────────────────────────────────────────────────────────────
      default:
        return detail || `Unexpected server response (${status}). Please try again.`;
    }
  }

  return "An unexpected error occurred. Please try again.";
};

console.log('API Configuration:', {
  baseURL: API_BASE_URL,
  platform: Platform.OS,
  isDev: __DEV__,
  isDevice: Device.isDevice,
  storageAvailable: storage.isAvailable()
});

export default api;
