
// import React, { useState } from 'react';
// import {
//   View,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   ScrollView,
//   Alert,
//   ActivityIndicator,
// } from 'react-native';
// import { adminAPI } from '../../../services/api';
// import styles from '../styles/ModifyUserScreenStyle';
// import { showAlert } from '../../../utils/customModal';


// const ModifyUserScreen = () => {
//   const [searchQuery, setSearchQuery] = useState('');
//   const [matchingUsers, setMatchingUsers] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [searching, setSearching] = useState(false);
//   const [userFound, setUserFound] = useState(null);
//   const [roles, setRoles] = useState([]);

//   // ✅ Use formatted roles for DB
//   const availableRoles = ['Security Admin', 'Security Guard', 'IT Admin'];

//   // Fetch users for autocomplete
//   const handleSearchUser = async (query) => {
//     setSearchQuery(query);
//     setUserFound(null);
//     setRoles([]);
//     setMatchingUsers([]);
//     if (!query.trim()) return;

//     setSearching(true);
//     try {
//       const results = await adminAPI.searchUsers(query.trim());
//       setMatchingUsers(results || []);
//     } catch (error) {
//       console.error('Error fetching users:', error);
//       setMatchingUsers([]);
//     } finally {
//       setSearching(false);
//     }
//   };

//   // Select user from dropdown
//   const handleSelectUser = (user) => {
//     setSearchQuery(user.username);
//     setUserFound(user);

//     // ✅ Split roles from DB (comma separated)
//     const userRoles = user.role ? user.role.split(',').map(r => r.trim()) : [];
//     setRoles(userRoles);

//     setMatchingUsers([]);
//   };

//   // ✅ Toggle multiple roles
//   const toggleRole = (role) => {
//     setRoles((prev) =>
//       prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
//     );
//   };

//   // Modify user
//   const handleModifyUser = async () => {
//     if (!userFound) {
//       showAlert('Error', 'Please select a user first');
//       return;
//     }
//     if (!roles.length) {
//       showAlert('Error', 'Please assign at least one role');
//       return;
//     }

//     setLoading(true);
//     try {
//       // ✅ Send roles as comma-separated string
//       await adminAPI.modifyUser(userFound.username, { role: roles.join(', ') });

//       showAlert('Success', `User "${userFound.username}" roles updated successfully!`, [
//         { text: 'OK', onPress: () => resetForm() },
//       ]);
//     } catch (error) {
//       console.error('Error modifying user:', error);
//       const msg = error.response?.data?.detail || 'Failed to update user';
//       showAlert('Error', msg);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleDeleteUser = () => {
//     if (!userFound) return;

//     showAlert(
//       'Confirm Delete',
//       `Are you sure you want to delete user "${userFound.username}"?`,
//       [
//         { text: 'Cancel', style: 'cancel' },
//         {
//           text: 'Delete',
//           style: 'destructive',
//           onPress: async () => {
//             setLoading(true);
//             try {
//               await adminAPI.deleteUser(userFound.username);
//               showAlert('Deleted', `User "${userFound.username}" deleted successfully!`);
//               resetForm();
//             } catch (error) {
//               console.error('Error deleting user:', error);
//               const msg = error.response?.data?.detail || 'Failed to delete user';
//               showAlert('Error', msg);
//             } finally {
//               setLoading(false);
//             }
//           },
//         },
//       ]
//     );
//   };

//   const resetForm = () => {
//     setSearchQuery('');
//     setUserFound(null);
//     setRoles([]);
//     setMatchingUsers([]);
//   };

//   return (
//     <ScrollView contentContainerStyle={styles.container}>
//       <View style={styles.card}>
//         <Text style={styles.title}>Modify User Role</Text>

//         {/* Search Input */}
//         <Text style={styles.label}>Search Username</Text>
//         <View style={{ position: 'relative', width: '100%' }}>
//           <TextInput
//             style={styles.input}
//             placeholder="Enter username"
//             value={searchQuery}
//             onChangeText={handleSearchUser}
//             autoCapitalize="none"
//           />
//           {searching && <ActivityIndicator style={{ position: 'absolute', right: 10, top: 15 }} />}

//           {/* Dropdown */}
// {matchingUsers.length > 0 && (
//   <View style={styles.dropdown}>
//     <ScrollView>
//       {matchingUsers.map((user) => (
//         <TouchableOpacity
//           key={user.username}          
//           onPress={() => handleSelectUser(user)}
//           style={styles.dropdownItem}
//         >
//           <Text>{user.username}</Text>
//         </TouchableOpacity>
//       ))}
//     </ScrollView>
//   </View>
//  )}
 
//         </View>

//         {/* User Info */}
//         {userFound && (
//           <View style={styles.userInfo}>
//             <Text style={styles.userInfoTitle}>User Found:</Text>
//             <Text style={styles.userInfoText}>Username: {userFound.username}</Text>
//             <Text style={styles.userInfoText}>
//               Name: {userFound.first_name} {userFound.last_name}
//             </Text>
//             <Text style={styles.userInfoText}>
//               Current Roles: {roles.join(', ')}
//             </Text>
//           </View>
//         )}

//         {/* Roles */}
//         {userFound && (
//           <View style={styles.rolesContainer}>
//             {availableRoles.map((role) => (
//               <TouchableOpacity
//                 key={role}
//                 style={[
//                   styles.roleButton,
//                   roles.includes(role) && styles.roleButtonSelected,
//                 ]}
//                 onPress={() => toggleRole(role)}
//               >
//                 <Text
//                   style={[
//                     styles.roleButtonText,
//                     roles.includes(role) && styles.roleButtonTextSelected,
//                   ]}
//                 >
//                   {role}
//                 </Text>
//               </TouchableOpacity>
//             ))}
//           </View>
//         )}

//         {/* Action Buttons */}
//         {userFound && (
//           <>
//             <TouchableOpacity
//               style={[styles.modifyButton, loading && styles.modifyButtonDisabled]}
//               onPress={handleModifyUser}
//               disabled={loading}
//             >
//               {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modifyText}>Update Roles</Text>}
//             </TouchableOpacity>

//             <TouchableOpacity
//               style={[styles.deleteButton, loading && styles.modifyButtonDisabled]}
//               onPress={handleDeleteUser}
//               disabled={loading}
//             >
//               <Text style={styles.deleteButtonText}>Delete User</Text>
//             </TouchableOpacity>
//           </>
//         )}
//       </View>
//     </ScrollView>
//   );
// };

// export default ModifyUserScreen;





import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { adminAPI } from '../../../services/api';
import styles from '../styles/ModifyUserScreenStyle';
import { showAlert } from '../../../utils/customModal';

const ModifyUserScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [matchingUsers, setMatchingUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [userFound, setUserFound] = useState(null);
  const [roles, setRoles] = useState([]);
  const [selected, setSelected] = useState('modify'); // 🔹 toggle state

  // ✅ Available roles
  const availableRoles = ['Security Admin', 'Security Guard', 'IT Admin'];

  // 🔹 Edit Details form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Fetch users for autocomplete
  const handleSearchUser = async (query) => {
    setSearchQuery(query);
    setUserFound(null);
    setRoles([]);
    setMatchingUsers([]);
    if (!query.trim()) return;

    setSearching(true);
    try {
      const results = await adminAPI.searchUsers(query.trim());
      setMatchingUsers(results || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      setMatchingUsers([]);
    } finally {
      setSearching(false);
    }
  };

  // Select user from dropdown
  const handleSelectUser = (user) => {
    setSearchQuery(user.username);
    setUserFound(user);

    const userRoles = user.role ? user.role.split(',').map((r) => r.trim()) : [];
    setRoles(userRoles);

    // ✅ Autofill details for edit form
    setFirstName(user.first_name || '');
    setLastName(user.last_name || '');
    setEmail(user.email || '');
    setPhoneNumber(user.phone_number || '');

    setMatchingUsers([]);
  };

  // Toggle multiple roles
  const toggleRole = (role) => {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  // Modify user roles
  const handleModifyUser = async () => {
    if (!userFound) {
      showAlert('Error', 'Please select a user first');
      return;
    }
    if (!roles.length) {
      showAlert('Error', 'Please assign at least one role');
      return;
    }

    setLoading(true);
    try {
      await adminAPI.modifyUser(userFound.username, { role: roles.join(', ') });

      showAlert('Success', `User "${userFound.username}" roles updated successfully!`, [
        { text: 'OK', onPress: () => resetForm() },
      ]);
    } catch (error) {
      console.error('Error modifying user:', error);
      const msg = error.response?.data?.detail || 'Failed to update user';
      showAlert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  // Delete user
  const handleDeleteUser = () => {
    if (!userFound) return;

    showAlert(
      'Confirm Delete',
      `Are you sure you want to delete user "${userFound.username}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await adminAPI.deleteUser(userFound.username);
              showAlert('Deleted', `User "${userFound.username}" deleted successfully!`);
              resetForm();
            } catch (error) {
              console.error('Error deleting user:', error);
              const msg = error.response?.data?.detail || 'Failed to delete user';
              showAlert('Error', msg);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setSearchQuery('');
    setUserFound(null);
    setRoles([]);
    setMatchingUsers([]);
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhoneNumber('');
  };

  // Save edited details
  const handleSaveDetails = async () => {
    if (!userFound) {
      showAlert('Error', 'Please select a user first');
      return;
    }
    if (!firstName || !lastName || !email || !phoneNumber) {
      showAlert('Error', 'Please fill all fields');
      return;
    }
    if (phoneNumber.length !== 10) {
      showAlert('Error', 'Phone number must be exactly 10 digits');
      return;
    }

    setLoading(true);
    try {
      await adminAPI.updateUser(userFound.username, {
        first_name: firstName,
        last_name: lastName,
        email,
        phone_number: phoneNumber,
      });

      showAlert('Success', `User "${userFound.username}" details updated successfully!`, [
        { text: 'OK', onPress: () => resetForm() },
      ]);
    } catch (error) {
      console.error('Error updating user:', error);
      const msg = error.response?.data?.detail || 'Failed to update user';
      showAlert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        {/* 🔹 Toggle Buttons */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleButton, selected === 'modify' && styles.activeButton]}
            onPress={() => setSelected('modify')}
          >
            <Text style={[styles.toggleText, selected === 'modify' && styles.activeText]}>
              Modify User
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toggleButton, selected === 'edit' && styles.activeButton]}
            onPress={() => setSelected('edit')}
          >
            <Text style={[styles.toggleText, selected === 'edit' && styles.activeText]}>
              Edit Details
            </Text>
          </TouchableOpacity>
        </View>

        {/* 🔹 Common Search Section */}
        <Text style={styles.label}>Search Username</Text>
        <View style={{ position: 'relative', width: '100%' }}>
          <TextInput
            style={styles.input}
            placeholder="Enter username"
            value={searchQuery}
            onChangeText={handleSearchUser}
            autoCapitalize="none"
          />
          {searching && <ActivityIndicator style={{ position: 'absolute', right: 10, top: 15 }} />}

          {matchingUsers.length > 0 && (
            <View style={styles.dropdown}>
              <ScrollView>
                {matchingUsers.map((user) => (
                  <TouchableOpacity
                    key={user.username}
                    onPress={() => handleSelectUser(user)}
                    style={styles.dropdownItem}
                  >
                    <Text>{user.username}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* 🔹 Modify User Section */}
        {selected === 'modify' && userFound && (
          <>
            <Text style={styles.title}>Modify User Role</Text>
            <View style={styles.userInfo}>
              <Text style={styles.userInfoTitle}>User Found:</Text>
              <Text style={styles.userInfoText}>Username: {userFound.username}</Text>
              <Text style={styles.userInfoText}>
                Name: {userFound.first_name} {userFound.last_name}
              </Text>
              <Text style={styles.userInfoText}>Current Roles: {roles.join(', ')}</Text>
            </View>

            {/* Roles */}
            <View style={styles.rolesContainer}>
              {availableRoles.map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[styles.roleButton, roles.includes(role) && styles.roleButtonSelected]}
                  onPress={() => toggleRole(role)}
                >
                  <Text
                    style={[
                      styles.roleButtonText,
                      roles.includes(role) && styles.roleButtonTextSelected,
                    ]}
                  >
                    {role}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Action Buttons */}
            <TouchableOpacity
              style={[styles.modifyButton, loading && styles.modifyButtonDisabled]}
              onPress={handleModifyUser}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modifyText}>Update Roles</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.deleteButton, loading && styles.modifyButtonDisabled]}
              onPress={handleDeleteUser}
              disabled={loading}
            >
              <Text style={styles.deleteButtonText}>Delete User</Text>
            </TouchableOpacity>
          </>
        )}

        {/* 🔹 Edit User Details Section */}
        {selected === 'edit' && userFound && (
          <>
            <Text style={styles.title}>Edit User Details</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>First Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter first name"
                value={firstName}
                onChangeText={setFirstName}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Last Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter last name"
                value={lastName}
                onChangeText={setLastName}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter email"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter phone number"
                keyboardType="numeric"
                maxLength={10}
                value={phoneNumber}
                onChangeText={(text) => {
                  const digitsOnly = text.replace(/[^0-9]/g, '');
                  setPhoneNumber(digitsOnly);
                }}
              />
            </View>

            <TouchableOpacity
              style={[styles.modifyButton, loading && styles.modifyButtonDisabled]}
              onPress={handleSaveDetails}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modifyText}>Save</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
};

export default ModifyUserScreen;
