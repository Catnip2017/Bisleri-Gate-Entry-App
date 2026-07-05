// utils/validators.js - Shared field validators for gate-entry operational data.
// Single source of truth used by BOTH the create form (GateEntryTab) and the
// edit modal (OperationalEditModal) so create/edit rules can never diverge.

export const validateVehicleNo = (value) => {
  if (!value || !value.trim()) {
    return { isValid: false, error: 'Vehicle number is required' };
  }
  if (value.trim().length < 8) {
    return { isValid: false, error: 'Vehicle number must be at least 8 characters' };
  }
  return { isValid: true, error: '' };
};

export const validateDriverName = (value) => {
  if (!value || !value.trim()) {
    return { isValid: false, error: 'Driver name is required' };
  }
  if (value.trim().length < 2) {
    return { isValid: false, error: 'Driver name must be at least 2 characters' };
  }
  if (value.trim().length > 50) {
    return { isValid: false, error: 'Driver name must be less than 50 characters' };
  }
  return { isValid: true, error: '' };
};

export const validateKMReading = (value) => {
  if (!value || !String(value).trim()) {
    return { isValid: false, error: 'KM reading is required' };
  }
  const cleanValue = String(value).replace(/[^0-9]/g, '');
  if (!cleanValue) {
    return { isValid: false, error: 'KM reading must be numeric' };
  }
  if (cleanValue.length < 3 || cleanValue.length > 6) {
    return { isValid: false, error: 'KM reading must be 3-6 digits' };
  }
  const kmValue = parseInt(cleanValue, 10);
  if (kmValue < 0 || kmValue > 999999) {
    return { isValid: false, error: 'KM reading must be between 0 and 999999' };
  }
  return { isValid: true, error: '' };
};

export const validateLoaderCount = (value) => {
  const cleanValue = String(value ?? '').replace(/[^0-9]/g, '');
  if (cleanValue === '') {
    return { isValid: false, error: 'Loader count is required' };
  }
  const count = parseInt(cleanValue, 10);
  if (count < 0 || count > 20) {
    return { isValid: false, error: 'Loader count must be between 0-20' };
  }
  return { isValid: true, error: '' };
};

export const validateLoaderNames = (value) => {
  if (!value || !value.trim()) {
    return { isValid: false, error: 'Loader names are required' };
  }
  const names = value
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name);
  if (names.length === 0) {
    return { isValid: false, error: 'At least one loader name is required' };
  }
  if (names.length > 10) {
    return { isValid: false, error: 'Maximum 10 loader names allowed' };
  }
  for (const name of names) {
    if (name.length < 2) {
      return { isValid: false, error: 'Each loader name must be at least 2 characters' };
    }
  }
  return { isValid: true, error: '' };
};

/**
 * Validate the full operational data object in one call.
 * @param {{driver_name?: string, km_reading?: string, loader_count?: string, loader_names?: string}} data
 * @returns {{isValid: boolean, errors: object, firstError: string|null}}
 */
export const validateOperationalData = (data = {}) => {
  const checks = {
    driver_name: validateDriverName(data.driver_name),
    km_reading: validateKMReading(data.km_reading),
    loader_count: validateLoaderCount(data.loader_count),
    loader_names: validateLoaderNames(data.loader_names),
  };

  const errors = {};
  let firstError = null;
  for (const [field, result] of Object.entries(checks)) {
    errors[field] = result.error;
    if (!result.isValid && firstError === null) {
      firstError = result.error;
    }
  }

  return { isValid: firstError === null, errors, firstError };
};
