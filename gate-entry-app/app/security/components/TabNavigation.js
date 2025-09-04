// // app/security/components/TabNavigation.js - UPDATED with 3 tabs (FG Entry, FG Insights, RM Insights)
// import React from 'react';
// import { View, TouchableOpacity, Text } from 'react-native';
// import styles from '../styles/dashboardStyles';

// const TabNavigation = ({ activeTab, onTabChange }) => {
//   return (
//     <View style={styles.buttonRow}>
//       {/* FG Entry Tab */}
//       <TouchableOpacity 
//         style={activeTab === 'fgentry' ? styles.activeButton : styles.inactiveButton}
//         onPress={() => onTabChange('fgentry')}
//       >
//         <Text style={styles.buttonText}>Gate Entry</Text>
//       </TouchableOpacity>

//       {/* FG Insights Tab */}
//       <TouchableOpacity 
//         style={activeTab === 'fginsights' ? styles.activeButton : styles.inactiveButton}
//         onPress={() => onTabChange('fginsights')}
//       >
//         <Text style={styles.buttonText}>FG Insights</Text>
//       </TouchableOpacity>

//       {/* RM Insights Tab */}
//       <TouchableOpacity 
//         style={activeTab === 'rminsights' ? styles.activeButton : styles.inactiveButton}
//         onPress={() => onTabChange('rminsights')}
//       >
//         <Text style={styles.buttonText}>RM Insights</Text>
//       </TouchableOpacity>
//     </View>
//   );
// };

// export default TabNavigation;

// app/security/components/TabNavigation.js - MERGED 3-Tab System
import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import styles from '../styles/dashboardStyles';

const TabNavigation = ({ activeTab, onTabChange }) => {
  return (
    <View style={styles.buttonRow}>
      {/* ✅ MERGED: Gate Entry Tab (FG/RM toggle inside) */}
      <TouchableOpacity 
        style={activeTab === 'fgentry' ? styles.activeButton : styles.inactiveButton}
        onPress={() => onTabChange('fgentry')}
      >
        <Text style={styles.buttonText}>Gate Entry</Text>
      </TouchableOpacity>

      {/* ✅ MERGED: FG Insights Tab */}
      <TouchableOpacity 
        style={activeTab === 'fginsights' ? styles.activeButton : styles.inactiveButton}
        onPress={() => onTabChange('fginsights')}
      >
        <Text style={styles.buttonText}>FG Insights</Text>
      </TouchableOpacity>

      {/* ✅ MERGED: RM Insights Tab */}
      <TouchableOpacity 
        style={activeTab === 'rminsights' ? styles.activeButton : styles.inactiveButton}
        onPress={() => onTabChange('rminsights')}
      >
        <Text style={styles.buttonText}>RM Insights</Text>
      </TouchableOpacity>
    </View>
  );
};

export default TabNavigation;