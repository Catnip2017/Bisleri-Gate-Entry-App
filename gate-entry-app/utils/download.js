// utils/download.js - Save a file the server sent as a blob (web only)
// and read the server's error message out of a failed blob request.
import { Platform } from 'react-native';
import { handleAPIError } from '../services/api';

export const canDownload = () => Platform.OS === 'web' && typeof document !== 'undefined';

export function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Blob responses carry the JSON error inside the blob.
export async function blobErrorMessage(error) {
  let msg = handleAPIError(error);
  try {
    const txt = await error?.response?.data?.text?.();
    if (txt) msg = JSON.parse(txt).detail || msg;
  } catch (e) { /* keep msg */ }
  return msg;
}

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
