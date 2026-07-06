// app/security/manual-entry/ManualEntryScreen.js
// Wrapped in the shared AppShell — standard header, sidebar, back chip.
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { getCurrentUser } from '../../../utils/jwtUtils';
import ManualEntryForm from './ManualEntryForm';
import AppShell from '../../../components/ui/AppShell';
import styles from './ManualEntryStyles';

const ManualEntryScreen = () => {
  const router = useRouter();
  const [userData, setUserData] = useState(null);

  // Load user data when component mounts
  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const user = await getCurrentUser();
      setUserData(user);
    } catch (error) {
      console.log('Error loading user data:', error);
    }
  };

  return (
    <AppShell
      title="Manual Gate Entry"
      backLabel="Gate Entry"
      onBack={() => router.push('/security/')}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <ManualEntryForm userData={userData} />
      </ScrollView>
    </AppShell>
  );
};

export default ManualEntryScreen;
