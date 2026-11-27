// app/documents/user-guides.js - User Guides (every signed-in user,
// 27 Nov 2026). PDFs are read from GUIDES_FOLDER on the server
// (D:\Bisleri Ops Hub\1_Documents\User Guides).
import React from 'react';
import DocumentLibrary from '../../components/ui/DocumentLibrary';

export default function UserGuidesScreen() {
  return <DocumentLibrary kind="guides" title="User Guides" />;
}
