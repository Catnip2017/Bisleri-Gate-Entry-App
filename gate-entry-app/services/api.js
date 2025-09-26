// services/api.js - MERGED Complete API Suite
import axios from 'axios';
import { storage } from '../utils/storage';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { getCurrentUser } from '../utils/jwtUtils';

// Get the appropriate API URL based on platform
const getApiUrl = () => {
  if (__DEV__) {
    if (Platform.OS === 'android') {
      if (Device.isDevice) {
        return 'http://192.168.1.2:8000'; // Local network for mobile development
      } else {
        return 'http://192.168.1.2:8000'; // Emulator
      }
    } else if (Platform.OS === 'ios') {
      return 'http://192.168.1.16:8000'; // iOS development
    }
    // Web platform - USE IP SINCE DOMAIN:19000 DOESN'T WORK
  return 'http://192.168.1.18:8000';
  }
  // Production - USE IP ADDRESS
  return 'http://192.168.1.18:8000';
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
    if (error.response?.status === 401) {
      try {
        await storage.removeItem('access_token');
      } catch (storageError) {
        console.warn('Failed to clear auth token:', storageError);
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
    const response = await api.post('/multi-document-manual-entry', multiEntryData);
    return response.data;
  },

  getUnassignedDocuments: async (vehicleNo, hoursBack = 8) => {
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
    const isWithin24Hours = timeSinceCreation <= 24 * 60 * 60 * 1000;
    const isOperationalComplete = editStatusUtils.isOperationalDataComplete(record);

    if (!isWithin24Hours) {
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
  let errorMessage = "An unexpected error occurred";
  
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data;
    
    switch (status) {
      case 400:
        if (data?.detail && data.detail.includes('already has Gate')) {
          errorMessage = data.detail;
        } else {
          errorMessage = data?.detail || "Invalid request data";
        }
        break;
      case 401:
        errorMessage = "Authentication failed. Please login again.";
        break;
      case 403:
        if (data?.detail && data.detail.includes('Edit window expired')) {
          errorMessage = "Edit window expired. Records can only be edited within 24 hours.";
        } else {
          errorMessage = "Access denied. Insufficient permissions.";
        }
        break;
      case 404:
        errorMessage = data?.detail || "No recent documents found";
        break;
      case 422:
        errorMessage = "Validation error. Please check your input.";
        break;
      case 500:
        errorMessage = "Server error. Please try again later.";
        break;
      default:
        errorMessage = data?.detail || `Server error (${status})`;
    }
  } else if (error.request) {
    errorMessage = "Network error. Please check your connection.";
  } else if (error.message) {
    errorMessage = error.message;
  }
  
  return errorMessage;
};

console.log('API Configuration:', {
  baseURL: API_BASE_URL,
  platform: Platform.OS,
  isDev: __DEV__,
  isDevice: Device.isDevice,
  storageAvailable: storage.isAvailable()
});

export default api;
