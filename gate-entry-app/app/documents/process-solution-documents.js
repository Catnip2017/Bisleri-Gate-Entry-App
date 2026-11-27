// app/documents/process-solution-documents.js - Process Solution Documents
// (IT Admin only, 27 Nov 2026). PDFs are read from PSD_FOLDER on the server
// (D:\Bisleri Ops Hub\1_Documents\Process Solution Documents); name them
// <Process_Name>_PSD_v<N>.pdf. Old versions go into the "Archive" sub-folder.
import React from 'react';
import DocumentLibrary from '../../components/ui/DocumentLibrary';

export default function ProcessSolutionDocumentsScreen() {
  return <DocumentLibrary kind="psd" title="Process Solution Documents" itAdminOnly />;
}
