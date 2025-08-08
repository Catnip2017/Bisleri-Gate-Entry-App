// services/api.js - COMPLETE ENHANCED WITH DOCUMENT ASSIGNMENT FUNCTIONALITY
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import * as Device from 'expo-device';

// Get the appropriate API URL based on platform
const getApiUrl = () => {
  if (__DEV__) {
    if (Platform.OS === 'android') {
      if (Device.isDevice) {
        return 'http://192.168.1.56:8000';
      } else {
        return 'http://10.0.2.2:8000';
      }
    } else if (Platform.OS === 'ios') {
      return 'http://192.168.51.151:8000';
    }
    return 'http://192.168.51.151:8000';
  }
  return 'https://your-production-api.com';
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
    const token = await SecureStore.getItemAsync('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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
      await SecureStore.deleteItemAsync('access_token');
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
    const response = await api.post('/logout');
    await SecureStore.deleteItemAsync('access_token');
    return response.data;
  },
};

// ✅ ENHANCED: Gate APIs with Document Assignment Support
export const gateAPI = {
  // Search recent documents (18-hour filter)
  searchRecentDocuments: async (vehicleNo) => {
    if (!vehicleNo?.trim()) {
      throw new Error('Vehicle number is required');
    }
    
    const response = await api.get(`/search-recent-documents/${vehicleNo.trim()}`);
    return response.data;
  },

  // Check vehicle gate status for validation
  getVehicleStatus: async (vehicleNo) => {
    if (!vehicleNo?.trim()) {
      throw new Error('Vehicle number is required');
    }
    
    const response = await api.get(`/vehicle-status/${vehicleNo.trim()}`);
    return response.data;
  },

  // ✅ NEW: Enhanced batch gate entry with operational data
  createEnhancedBatchGateEntry: async (batchData) => {
    if (!batchData.vehicle_no?.trim()) {
      throw new Error('Vehicle number is required');
    }
    
    if (!batchData.document_nos || batchData.document_nos.length === 0) {
      throw new Error('At least one document must be selected');
    }
    
    const response = await api.post('/enhanced-batch-gate-entry', batchData);
    return response.data;
  },

  // Standard batch gate entry (legacy support)
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
  
  // ✅ NEW: Enhanced manual gate entry with operational data
  createEnhancedManualGateEntry: async (manualEntryData) => {
    if (!manualEntryData.vehicle_no?.trim()) {
      throw new Error('Vehicle number is required');
    }
    
    const response = await api.post('/enhanced-manual-gate-entry', manualEntryData);
    return response.data;
  },

  // Standard manual gate entry (legacy support)
  createManualGateEntry: async (manualEntryData) => {
    if (!manualEntryData.vehicle_no?.trim()) {
      throw new Error('Vehicle number is required');
    }
    
    const response = await api.post('/manual-gate-entry', manualEntryData);
    return response.data;
  },

  // ✅ NEW: Multi-document manual entry
  createMultiDocumentManualEntry: async (multiEntryData) => {
    if (!multiEntryData.vehicle_no?.trim()) {
      throw new Error('Vehicle number is required');
    }
    
    if (!multiEntryData.no_of_documents || multiEntryData.no_of_documents < 1) {
      throw new Error('Number of documents must be at least 1');
    }
    
    const response = await api.post('/multi-document-manual-entry', multiEntryData);
    return response.data;
  },

  // ✅ NEW: Get unassigned documents for vehicle
  getUnassignedDocuments: async (vehicleNo, hoursBack = 1) => {
    if (!vehicleNo?.trim()) {
      throw new Error('Vehicle number is required');
    }
    
    const response = await api.get(`/unassigned-documents/${vehicleNo.trim()}?hours_back=${hoursBack}`);
    return response.data;
  },

  // ✅ NEW: Assign document to manual entry
  assignDocumentToManualEntry: async (assignmentData) => {
    if (!assignmentData.insights_id || !assignmentData.document_no) {
      throw new Error('Both insights_id and document_no are required');
    }
    
    const response = await api.post('/assign-document-to-manual-entry', assignmentData);
    return response.data;
  },
  
  // Legacy gate entry (single document - backward compatibility)
  createGateEntry: async (entryData) => {
    const response = await api.post('/gate-entry', entryData);
    return response.data;
  },
  
  // Document search (all documents for vehicle)
  getDocumentsByVehicle: async (vehicleNo) => {
    const response = await api.get(`/documents/${vehicleNo}`);
    return response.data;
  },
  
  // Advanced document search with filters
  searchDocuments: async (searchParams) => {
    const queryString = new URLSearchParams(
      Object.entries(searchParams).filter(([_, value]) => value)
    ).toString();
    
    const response = await api.get(`/search-documents?${queryString}`);
    return response.data;
  },
  
  // Get vehicle movement history
  getVehicleHistory: async (vehicleNo) => {
    const response = await api.get(`/vehicle-history/${vehicleNo}`);
    return response.data;
  },

  // ✅ NEW: Get operational data summary
  getOperationalSummary: async () => {
    const response = await api.get('/operational-summary');
    return response.data;
  },
};

// ✅ ENHANCED: Insights APIs with Operational Edit Functionality
export const insightsAPI = {
  getDashboardStats: async () => {
    const response = await api.get('/dashboard-stats');
    return response.data;
  },
  
  getVehicleMovements: async (filter) => {
    const response = await api.post('/vehicle-movements', filter);
    return response.data;
  },
  
  // Enhanced filtered movements with operational status
  getFilteredMovements: async (filters) => {
    const filterData = {
      from_date: filters.fromDate,
      to_date: filters.toDate,
      site_code: filters.siteCode || null,
      warehouse_code: filters.warehouseCode || null,
      movement_type: filters.movementType || null,
      vehicle_no: filters.vehicleNo || null,
      manual_only: filters.manualOnly || false,
      needs_edit: filters.needsEdit || false
    };
    
    const response = await api.post('/filtered-movements', filterData);
    return response.data;
  },
  
  getDocumentDetails: async (documentNo) => {
    const response = await api.get(`/document/${documentNo}`);
    return response.data;
  },

  // ✅ NEW: Update operational data (replaces old edit functionality)
  updateOperationalData: async (editData) => {
    if (!editData.gate_entry_no) {
      throw new Error('Gate entry number is required');
    }

    // Validate operational fields
    const validationErrors = operationalValidation.validateEditForm(editData);
    if (!validationErrors.isValid) {
      throw new Error(`Validation failed: ${Object.values(validationErrors.errors).join(', ')}`);
    }

    const response = await api.put('/update-operational-data', editData);
    return response.data;
  },

  // ✅ NEW: Get edit statistics
  getEditStatistics: async () => {
    const response = await api.get('/edit-statistics');
    return response.data;
  },

  // ✅ NEW: Get KM reading context
  getKMReadingContext: async (gateEntryNo) => {
    const response = await api.get(`/km-reading-context/${gateEntryNo}`);
    return response.data;
  },

  // ✅ NEW: Get records needing completion (YELLOW button candidates)
  getRecordsNeedingCompletion: async () => {
    const response = await api.get('/records-needing-completion');
    return response.data;
  },

  // BACKWARD COMPATIBILITY: Keep old edit method
  updateGateEntry: async (editData) => {
    console.warn('updateGateEntry is deprecated, use updateOperationalData instead');
    return insightsAPI.updateOperationalData(editData);
  },
};

// ✅ NEW: Document assignment utilities
export const documentAssignmentUtils = {
  // Check if insights record needs document assignment
  needsDocumentAssignment: (record) => {
    return record.document_type === "Manual Entry - Pending Assignment" ||
           (record.document_type === "Manual Entry" && !record.document_date);
  },

  // Format document option for dropdown
  formatDocumentOption: (document) => {
    const ageText = document.age_hours 
      ? `${Math.round(document.age_hours * 10) / 10}h ago`
      : 'Recent';
      
    return {
      label: `${document.document_no} (${document.document_type}) - ${ageText}`,
      value: document.document_no,
      document: document
    };
  },

  // Get assignment button text
  getAssignmentButtonText: (record, hasSelectedDocument) => {
    if (!hasSelectedDocument) {
      return 'Select Document';
    }
    
    if (documentAssignmentUtils.needsDocumentAssignment(record)) {
      return '📎 Assign Document';
    }
    
    return 'Already Assigned';
  },

  // Check if record can be assigned
  canAssignDocument: (record) => {
    return documentAssignmentUtils.needsDocumentAssignment(record) &&
           record.edit_status !== 'expired';
  }
};

// ✅ NEW: Multi-entry helpers
export const multiEntryHelpers = {
  // Group insights records by gate entry number
  groupByGateEntry: (insights) => {
    const grouped = {};
    
    insights.forEach(record => {
      const gateNo = record.gate_entry_no;
      if (!grouped[gateNo]) {
        grouped[gateNo] = [];
      }
      grouped[gateNo].push(record);
    });
    
    return grouped;
  },

  // Check if gate entry has unassigned documents
  hasUnassignedDocuments: (gateEntryGroup) => {
    return gateEntryGroup.some(record => 
      documentAssignmentUtils.needsDocumentAssignment(record)
    );
  },

  // Get assignment progress for gate entry group
  getAssignmentProgress: (gateEntryGroup) => {
    const total = gateEntryGroup.length;
    const assigned = gateEntryGroup.filter(record => 
      !documentAssignmentUtils.needsDocumentAssignment(record)
    ).length;
    
    return {
      assigned,
      total,
      percentage: Math.round((assigned / total) * 100),
      isComplete: assigned === total
    };
  },

  // Format progress text
  formatProgressText: (progress) => {
    if (progress.isComplete) {
      return `✅ Complete (${progress.assigned}/${progress.total})`;
    }
    
    return `⏳ ${progress.assigned}/${progress.total} assigned (${progress.percentage}%)`;
  }
};

// ✅ NEW: Operational field validation utilities
export const operationalValidation = {
  validateDriverName: (name) => {
    if (!name || !name.trim()) {
      return { isValid: false, error: 'Driver name is required for completion' };
    }
    
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 50) {
      return { isValid: false, error: 'Driver name must be 2-50 characters' };
    }
    
    return { isValid: true, value: trimmed };
  },

  validateKMReading: (kmReading, movementType) => {
    if (!kmReading || !kmReading.trim()) {
      return { isValid: false, error: 'KM reading is required for completion' };
    }
    
    const trimmed = kmReading.trim();
    
    // Must be numeric
    if (!/^\d+$/.test(trimmed)) {
      return { isValid: false, error: 'KM reading must be numeric only' };
    }
    
    // Length validation
    if (trimmed.length < 3 || trimmed.length > 6) {
      return { isValid: false, error: 'KM reading must be 3-6 digits' };
    }
    
    // Range validation
    const kmValue = parseInt(trimmed);
    if (kmValue < 0 || kmValue > 999999) {
      return { isValid: false, error: 'KM reading must be between 0 and 999,999' };
    }
    
    return { 
      isValid: true, 
      value: trimmed,
      type: movementType === 'Gate-Out' ? 'km_out' : 'km_in'
    };
  },

  validateLoaderNames: (loaderNames) => {
    if (!loaderNames || !loaderNames.trim()) {
      return { isValid: false, error: 'Loader names are required for completion' };
    }
    
    const trimmed = loaderNames.trim();
    
    // Split by comma and validate each
    const names = trimmed.split(',').map(name => name.trim()).filter(name => name);
    
    if (names.length === 0) {
      return { isValid: false, error: 'At least one loader name is required' };
    }
    
    if (names.length > 10) {
      return { isValid: false, error: 'Maximum 10 loader names allowed' };
    }
    
    // Validate each name
    for (let name of names) {
      if (name.length < 2) {
        return { isValid: false, error: 'Each loader name must be at least 2 characters' };
      }
    }
    
    return { 
      isValid: true, 
      value: names.join(', '),
      count: names.length 
    };
  },

  validateEditForm: (formData) => {
    const errors = {};

    // Driver name validation
    if (formData.driver_name !== undefined && formData.driver_name !== null) {
      const driverValidation = operationalValidation.validateDriverName(formData.driver_name);
      if (!driverValidation.isValid) {
        errors.driver_name = driverValidation.error;
      }
    }

    // KM reading validation
    if (formData.km_reading !== undefined && formData.km_reading !== null) {
      const kmValidation = operationalValidation.validateKMReading(
        formData.km_reading, 
        formData.movement_type || 'Gate-In'
      );
      if (!kmValidation.isValid) {
        errors.km_reading = kmValidation.error;
      }
    }

    // Loader names validation
    if (formData.loader_names !== undefined && formData.loader_names !== null) {
      const loaderValidation = operationalValidation.validateLoaderNames(formData.loader_names);
      if (!loaderValidation.isValid) {
        errors.loader_names = loaderValidation.error;
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }
};

// ✅ NEW: Edit status utilities for 3-color button system
export const editStatusUtils = {
  // Get button configuration based on record status
  getButtonConfig: (record) => {
    if (!record.edit_button_config) {
      return editStatusUtils.calculateButtonConfig(record);
    }
    return record.edit_button_config;
  },

  // Fallback calculation if backend doesn't provide button config
  calculateButtonConfig: (record) => {
    const timeSinceCreation = editStatusUtils.getTimeSinceCreation(record);
    const isWithin24Hours = timeSinceCreation <= 24 * 60 * 60 * 1000;
    const isOperationalComplete = editStatusUtils.isOperationalDataComplete(record);
    const missingFields = editStatusUtils.getMissingFields(record);

    if (!isWithin24Hours) {
      return {
        color: 'black',
        text: '⚫ Expired',
        enabled: false,
        priority: 'none',
        message: 'Edit window expired (24+ hours)',
        action: 'view_only'
      };
    }

    if (!record.can_edit) {
      return {
        color: 'gray',
        text: '🚫 No Access',
        enabled: false,
        priority: 'none',
        message: 'Only creator or admin can edit',
        action: 'no_access'
      };
    }

    if (!isOperationalComplete) {
      return {
        color: 'yellow',
        text: '⚠️ Complete Info',
        enabled: true,
        priority: 'high',
        message: `Missing: ${missingFields.join(', ')} | ${editStatusUtils.getTimeRemaining(record)} remaining`,
        action: 'complete_required',
        missing_fields: missingFields
      };
    }

    return {
      color: 'green',
      text: '✅ Edit Details',
      enabled: true,
      priority: 'medium',
      message: `All data complete | ${editStatusUtils.getTimeRemaining(record)} remaining`,
      action: 'edit_optional',
      edit_count: record.edit_count || 0
    };
  },

  // Check if operational data is complete
  isOperationalDataComplete: (record) => {
    return !!(
      record.driver_name && record.driver_name.trim() &&
      record.km_reading && record.km_reading.trim() &&
      record.loader_names && record.loader_names.trim()
    );
  },

  // Get missing operational fields
  getMissingFields: (record) => {
    const missing = [];
    
    if (!record.driver_name || !record.driver_name.trim()) {
      missing.push('Driver Name');
    }
    
    if (!record.km_reading || !record.km_reading.trim()) {
      missing.push('KM Reading');
    }
    
    if (!record.loader_names || !record.loader_names.trim()) {
      missing.push('Loader Names');
    }
    
    return missing;
  },

  // Calculate time since record creation
  getTimeSinceCreation: (record) => {
    try {
      const recordDateTime = new Date(`${record.date}T${record.time}`);
      return Date.now() - recordDateTime.getTime();
    } catch (error) {
      return Infinity; // Treat invalid dates as expired
    }
  },

  // Get remaining time in human-readable format
  getTimeRemaining: (record) => {
    const timeSinceCreation = editStatusUtils.getTimeSinceCreation(record);
    const timeRemaining = (24 * 60 * 60 * 1000) - timeSinceCreation;
    
    if (timeRemaining <= 0) return null;
    
    const hours = Math.floor(timeRemaining / (60 * 60 * 1000));
    const minutes = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000));
    
    return `${hours}h ${minutes}m`;
  },

  // Priority sorting for edit queue
  getPriorityValue: (buttonConfig) => {
    const priorityMap = {
      'high': 1,      // Yellow - needs completion
      'medium': 2,    // Green - can edit
      'none': 3       // Black/Gray - can't edit
    };
    return priorityMap[buttonConfig.priority] || 4;
  },

  // Sort records by edit priority
  sortByEditPriority: (records) => {
    return records.sort((a, b) => {
      const configA = editStatusUtils.getButtonConfig(a);
      const configB = editStatusUtils.getButtonConfig(b);
      
      const priorityA = editStatusUtils.getPriorityValue(configA);
      const priorityB = editStatusUtils.getPriorityValue(configB);
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB; // High priority first
      }
      
      // Same priority - sort by time remaining (least time first)
      const timeA = editStatusUtils.getTimeSinceCreation(a);
      const timeB = editStatusUtils.getTimeSinceCreation(b);
      return timeB - timeA; // Most recent first
    });
  }
};

// ✅ NEW: KM Reading helpers
export const kmReadingHelpers = {
  // Get appropriate placeholder text
  getPlaceholder: (movementType) => {
    return movementType === 'Gate-Out' 
      ? 'Enter KM OUT (departure reading)'
      : 'Enter KM IN (arrival reading)';
  },

  // Get field label
  getLabel: (movementType) => {
    return movementType === 'Gate-Out' ? 'KM OUT Reading *' : 'KM IN Reading *';
  },

  // Format KM reading for display
  formatDisplay: (kmReading) => {
    if (!kmReading) return '--';
    return kmReading.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },

  // Validate against previous reading
  validateAgainstPrevious: (newReading, previousReading, movementType) => {
    if (!previousReading || !newReading) return { isValid: true };
    
    const newKm = parseInt(newReading);
    const prevKm = parseInt(previousReading);
    
    // KM reading should generally increase
    if (newKm < prevKm) {
      return {
        isValid: false,
        error: `New KM (${newKm}) is less than previous reading (${prevKm}). Please verify.`,
        warning: true
      };
    }
    
    // Reasonable daily distance check (500km max)
    const distance = newKm - prevKm;
    if (distance > 500) {
      return {
        isValid: false,
        error: `Distance of ${distance}km seems unusually high. Please verify.`,
        warning: true
      };
    }
    
    return { isValid: true, distance: distance };
  }
};

// ✅ Validation utilities (enhanced)
export const validationAPI = {
  validateVehicleNumber: (vehicleNo) => {
    if (!vehicleNo) return false;
    
    // Clean the vehicle number
    const cleaned = vehicleNo.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    // Basic Indian vehicle number validation
    const pattern = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;
    return pattern.test(cleaned) && cleaned.length >= 8 && cleaned.length <= 10;
  },
  
  validateDocumentNumber: (docNo) => {
    if (!docNo) return true; // Document number is optional
    return docNo.trim().length >= 3;
  },
  
  formatVehicleNumber: (vehicleNo) => {
    if (!vehicleNo) return '';
    return vehicleNo.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  },

  // Gate sequence validation helpers
  canPerformGateType: (vehicleStatus, requestedGateType) => {
    if (!vehicleStatus || vehicleStatus.status === "no_history") {
      return requestedGateType === "Gate-In";
    }
    
    if (requestedGateType === "Gate-In") {
      return vehicleStatus.can_gate_in;
    } else {
      return vehicleStatus.can_gate_out;
    }
  },

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

// ✅ Enhanced error handling utility
export const handleAPIError = (error) => {
  let errorMessage = "An unexpected error occurred";
  
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data;
    
    switch (status) {
      case 400:
        if (data?.detail && data.detail.includes('already has Gate')) {
          errorMessage = data.detail;
        } else if (data?.detail && data.detail.includes('already assigned')) {
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
        } else if (data?.detail && data.detail.includes('Assignment window expired')) {
          errorMessage = "Assignment window expired. Documents can only be assigned within 24 hours.";
        } else if (data?.detail && data.detail.includes('only edit your own')) {
          errorMessage = "You can only edit your own gate entries.";
        } else if (data?.detail && data.detail.includes('only assign documents to your own')) {
          errorMessage = "You can only assign documents to your own manual entries.";
        } else {
          errorMessage = "Access denied. Insufficient permissions.";
        }
        break;
      case 404:
        if (data?.detail && data.detail.includes('Manual entry not found')) {
          errorMessage = "Manual entry not found.";
        } else if (data?.detail && data.detail.includes('Document not found')) {
          errorMessage = "Document not found.";
        } else {
          errorMessage = data?.detail || "No recent documents found";
        }
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

// ✅ Gate operation helpers (enhanced)
export const gateHelpers = {
  // Check if vehicle is empty (no documents found)
  isEmptyVehicle: (searchResults) => {
    return !searchResults || searchResults.count === 0;
  },

  // Determine next action based on search results
  getRecommendedAction: (searchResults, vehicleStatus) => {
    if (gateHelpers.isEmptyVehicle(searchResults)) {
      return {
        action: 'manual_entry',
        reason: 'No documents found - vehicle appears to be empty',
        message: 'This vehicle has no recent documents. Create a manual entry.'
      };
    }

    return {
      action: 'regular_entry',
      reason: 'Documents found - process regular gate entry',
      message: `Found ${searchResults.count} document(s). Select documents to process.`
    };
  },

  // Format gate entry success message
  formatSuccessMessage: (result, isManual = false) => {
    if (isManual) {
      return `Manual ${result.movement_type} completed successfully!\nGate Entry No: ${result.gate_entry_no}\nVehicle: ${result.vehicle_no}`;
    }

    return `${result.movement_type} completed successfully!\nProcessed: ${result.records_processed}/${result.total_requested} documents\nGate Entry No: ${result.gate_entry_no}`;
  },

  // Check if gate type is valid for vehicle
  validateGateTypeForVehicle: (vehicleStatus, selectedGateType) => {
    const error = validationAPI.getGateSequenceError(vehicleStatus, selectedGateType);
    return {
      isValid: !error,
      error: error
    };
  },

  // Get vehicle status display text
  getVehicleStatusText: (vehicleStatus) => {
    if (!vehicleStatus || vehicleStatus.status === "no_history") {
      return "No previous movements";
    }

    const lastMovement = vehicleStatus.last_movement;
    const date = new Date(lastMovement.date).toLocaleDateString();
    return `Last: ${lastMovement.type} on ${date}`;
  },

  // Determine button text based on context
  getSubmitButtonText: (searchResults, selectedDocuments, isSubmitting) => {
    if (isSubmitting) {
      return 'Submitting...';
    }

    if (!searchResults) {
      return 'Search First';
    }

    if (gateHelpers.isEmptyVehicle(searchResults)) {
      return 'Manual Entry';
    }

    if (selectedDocuments.length === 0) {
      return 'Select Documents';
    }

    return `Submit (${selectedDocuments.length} selected)`;
  },

  // ✅ NEW: Edit-related helpers
  canEditRecord: (record, currentUser) => {
    if (!record || !currentUser) return false;

    // Check 24-hour window
    const entryDateTime = new Date(`${record.date}T${record.time}`);
    const now = new Date();
    const timeDiff = now - entryDateTime;
    const twentyFourHoursInMs = 24 * 60 * 60 * 1000;

    if (timeDiff > twentyFourHoursInMs) return false;

    // Check permissions (creator or admin)
    return currentUser.role === 'Admin' || record.security_username === currentUser.username;
  },

  getTimeRemaining: (entryDate, entryTime) => {
    try {
      const entryDateTime = new Date(`${entryDate}T${entryTime}`);
      const now = new Date();
      const timeDiff = 24 * 60 * 60 * 1000 - (now - entryDateTime); // 24 hours in ms
      
      if (timeDiff <= 0) return null;
      
      const hours = Math.floor(timeDiff / (60 * 60 * 1000));
      const minutes = Math.floor((timeDiff % (60 * 60 * 1000)) / (60 * 1000));
      
      return `${hours}h ${minutes}m`;
    } catch (error) {
      return null;
    }
  },

  needsEdit: (record) => {
    return record.document_type === 'Manual Entry' && 
           (!record.vehicle_no || record.vehicle_no === '[MISSING]' || record.vehicle_no.includes('MANUAL'));
  },

  getRecordStatus: (record, currentUser) => {
    if (gateHelpers.needsEdit(record)) {
      return { status: 'needs_edit', color: '#dc3545', label: '⚠️ Needs Edit', priority: 1 };
    }
    
    const timeRemaining = gateHelpers.getTimeRemaining(record.date, record.time);
    if (!timeRemaining) {
      return { status: 'expired', color: '#6c757d', label: '⚫ Expired', priority: 4 };
    }
    
    if (gateHelpers.canEditRecord(record, currentUser)) {
      return { status: 'editable', color: '#ffc107', label: `⏰ Editable (${timeRemaining})`, priority: 2 };
    }
    
    return { status: 'complete', color: '#28a745', label: '✅ Complete', priority: 3 };
  }
};

// ✅ Admin APIs (unchanged)
export const adminAPI = {
  registerUser: async (userData) => {
    const response = await api.post('/register-user', userData);
    return response.data;
  },

  resetPassword: async (resetData) => {
    const response = await api.post('/reset-password', resetData);
    return response.data;
  },

  listUsers: async () => {
    const response = await api.get('/list-users');
    return response.data;
  },
};

// ✅ Document APIs (unchanged)
export const documentAPI = {
  consolidateDocuments: async () => {
    const response = await api.post('/consolidate-documents');
    return response.data;
  },
};

// ✅ NEW: Edit utilities for frontend
export const editUtils = {
  validateEditForm: (formData) => {
    const errors = {};

    if (formData.vehicle_no && formData.vehicle_no.trim().length < 8) {
      errors.vehicle_no = 'Vehicle number must be at least 8 characters';
    }

    if (formData.vehicle_no && !validationAPI.validateVehicleNumber(formData.vehicle_no)) {
      errors.vehicle_no = 'Invalid vehicle number format';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  },

  formatEditData: (formData) => {
    return {
      gate_entry_no: formData.gate_entry_no,
      driver_name: formData.driver_name ? formData.driver_name.trim() : null,
      km_reading: formData.km_reading ? formData.km_reading.trim() : null,
      loader_names: formData.loader_names ? formData.loader_names.trim() : null,
      remarks: formData.remarks ? formData.remarks.trim() : null
    };
  },

  getEditPermissionMessage: (record, currentUser) => {
    const timeRemaining = gateHelpers.getTimeRemaining(record.date, record.time);
    
    if (!timeRemaining) {
      return "Edit window expired. Records can only be edited within 24 hours.";
    }

    if (currentUser.role !== 'Admin' && record.security_username !== currentUser.username) {
      return "You can only edit your own gate entries.";
    }

    return `You can edit this record for ${timeRemaining} more.`;
  }
};

// Test credentials for development
export const TEST_CREDENTIALS = {
  username: 'testuser',
  password: 'test123'
};

console.log('API Configuration:', {
  baseURL: API_BASE_URL,
  platform: Platform.OS,
  isDev: __DEV__,
  isDevice: Device.isDevice
});

export default api;