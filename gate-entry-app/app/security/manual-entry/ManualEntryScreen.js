// app/security/manual-entry/ManualEntryScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getCurrentUser } from '../../../utils/jwtUtils';
import ManualEntryForm from './ManualEntryForm';
import AppHeader from '../../../components/ui/AppHeader';
import BackChip from '../../../components/ui/BackChip';
import Sidebar from '../components/Sidebar';
import styles from './ManualEntryStyles';

const ManualEntryScreen = () => {
  const router = useRouter();
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
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

  const toggleSidebar = () => {
    setIsSidebarVisible(!isSidebarVisible);
  };

  const handleHomePress = () => {
    // Navigate back to security dashboard
    router.push('/security/');
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      {/* Standard header */}
      <AppHeader onMenuPress={toggleSidebar} />

      {/* Back navigation — standard blue chip, top-left */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10 }}>
        <BackChip label="Gate Entry" onPress={handleHomePress} />
      </View>

      {/* Main Content */}
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container}>
          {/* Title */}
          <View style={styles.titleContainer}>
            <Text style={styles.pageTitle}>Manual Gate Entry</Text>
          </View>

          {/* Manual Entry Form */}
          <ManualEntryForm userData={userData} />
        </ScrollView>
      </View>

      {/* Standard overlay sidebar */}
      <Sidebar
        isVisible={isSidebarVisible}
        onClose={() => setIsSidebarVisible(false)}
        userData={userData}
      />
    </SafeAreaView>
  );
};

export default ManualEntryScreen;