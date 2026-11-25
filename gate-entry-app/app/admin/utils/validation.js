// app/admin/utils/validation.js

export const validateUsername = (username) => {
  if (!username || username.trim().length < 3) {
    return 'Username must be at least 3 characters';
  }
  
  if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
    return 'Username can only contain letters, numbers, and underscores';
  }
  
  return null;
};

// Password policy (25 Nov 2026) — mirrored on the server
// (bisleri-backend/app/utils/account_rules.py): min 6 characters,
// 1 upper-case letter, 1 number, 1 special character.
export const validatePassword = (password) => {
  const pw = password || '';
  const missing = [];
  if (pw.length < 6) missing.push('at least 6 characters');
  if (!/[A-Z]/.test(pw)) missing.push('1 upper-case letter');
  if (!/\d/.test(pw)) missing.push('1 number');
  if (!/[^A-Za-z0-9]/.test(pw)) missing.push('1 special character');
  return missing.length ? `Password must have ${missing.join(', ')}.` : null;
};

// Compulsory 10-digit mobile number (25 Nov 2026)
export const validateMobile = (phone) =>
  /^\d{10}$/.test((phone || '').trim()) ? null : 'A valid 10-digit mobile number is required';

export const validateName = (name, fieldName) => {
  if (!name || name.trim().length < 2) {
    return `${fieldName} must be at least 2 characters`;
  }
  
  if (!/^[a-zA-Z\s]+$/.test(name.trim())) {
    return `${fieldName} can only contain letters and spaces`;
  }
  
  return null;
};

export const validatePasswordMatch = (password, confirmPassword) => {
  if (password !== confirmPassword) {
    return 'Passwords do not match';
  }
  
  return null;
};

export const getPasswordStrength = (password) => {
  if (!password) return { strength: 'none', color: '#ccc', text: '' };
  
  if (password.length < 6) {
    return { strength: 'weak', color: '#dc3545', text: 'Weak' };
  } else if (password.length < 8) {
    return { strength: 'medium', color: '#ffc107', text: 'Medium' };
  } else {
    return { strength: 'strong', color: '#28a745', text: 'Strong' };
  }
};