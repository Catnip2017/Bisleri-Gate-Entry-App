// app/documents/user-guides.js
// The other "Documents" sub-tab — see process-solution-documents.js for the
// shared pattern notes.
import React from 'react';
import { View } from 'react-native';
import AppShell from '../../components/ui/AppShell';
import DocumentList from '../../components/ui/DocumentList';

export default function UserGuidesScreen() {
  return (
    <AppShell title="User Guides" backLabel="Back">
      <View style={{ flex: 1, padding: 16, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
        <DocumentList rows={[]} />
      </View>
    </AppShell>
  );
}
