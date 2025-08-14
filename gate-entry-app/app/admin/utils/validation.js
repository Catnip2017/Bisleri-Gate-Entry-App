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

export const validatePassword = (password) => {
  if (!password || password.length < 6) {
    return 'Password must be at least 6 characters';
  }
  
  return null;
};

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