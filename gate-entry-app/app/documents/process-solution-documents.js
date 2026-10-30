// app/documents/process-solution-documents.js
// One of the two "Documents" sub-tabs opened from the global hamburger menu
// (30 Oct 2026). Pure download list — no preview, no folders, just file +
// updated date + a download button — per the 30 Oct 2026 decision. `rows`
// is empty until a storage/upload backend is wired up.
import React from 'react';
import { View } from 'react-native';
import AppShell from '../../components/ui/AppShell';
import DocumentList from '../../components/ui/DocumentList';

export default function ProcessSolutionDocumentsScreen() {
  return (
    <AppShell title="Process Solution Documents" backLabel="Back">
      <View style={{ flex: 1, padding: 16, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
        <DocumentList rows={[]} />
      </View>
    </AppShell>
  );
}
