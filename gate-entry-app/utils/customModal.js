// utils/customAlert.js - Cross-platform alert utility
import React, { useState } from 'react';
import { Alert, Platform, Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

// Global state for web modals
let setModalState = null;

// Custom Alert Modal Component (Web Only)
const CustomAlertModal = () => {
  const [modalData, setModalData] = useState({
    visible: false,
    title: '',
    message: '',
    buttons: []
  });

  // Register the modal state setter globally
  React.useEffect(() => {
    setModalState = setModalData;
    return () => {
      setModalState = null;
    };
  }, []);

  const handleButtonPress = (button) => {
    // Hide modal first
    setModalData({ visible: false, title: '', message: '', buttons: [] });
    
    // Execute button callback after a brief delay
    if (button.onPress) {
      setTimeout(() => {
        button.onPress();
      }, 100);
    }
  };

  const renderButtons = () => {
    const { buttons } = modalData;
    
    if (!buttons || buttons.length === 0) {
      return (
        <TouchableOpacity
          style={[styles.button, styles.defaultButton]}
          onPress={() => setModalData({ visible: false, title: '', message: '', buttons: [] })}
        >
          <Text style={styles.buttonText}>OK</Text>
        </TouchableOpacity>
      );
    }

    return buttons.map((button, index) => {
      let buttonStyle = styles.defaultButton;
      
      if (button.style === 'cancel') {
        buttonStyle = styles.cancelButton;
      } else if (button.style === 'destructive') {
        buttonStyle = styles.destructiveButton;
      }

      return (
        <TouchableOpacity
          key={index}
          style={[styles.button, buttonStyle]}
          onPress={() => handleButtonPress(button)}
        >
          <Text style={[
            styles.buttonText,
            button.style === 'destructive' && styles.destructiveText
          ]}>
            {button.text}
          </Text>
        </TouchableOpacity>
      );
    });
  };

  if (!modalData.visible) return null;

  return (
    <Modal
      transparent={true}
      visible={modalData.visible}
      animationType="none"
      onRequestClose={() => setModalData({ visible: false, title: '', message: '', buttons: [] })}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Title */}
          {modalData.title ? (
            <Text style={styles.title}>{modalData.title}</Text>
          ) : null}
          
          {/* Message */}
          {modalData.message ? (
            <Text style={styles.message}>{modalData.message}</Text>
          ) : null}
          
          {/* Buttons */}
          <View style={styles.buttonContainer}>
            {renderButtons()}
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Main showAlert function
export const showAlert = (title, message, buttons = [], options = {}) => {
  if (Platform.OS === 'web') {
    // Use custom modal on web
    if (setModalState) {
      setModalState({
        visible: true,
        title: title || '',
        message: message || '',
        buttons: buttons || []
      });
    } else {
      console.warn('CustomAlertModal not initialized. Make sure to include CustomAlertProvider in your app.');
    }
  } else {
    // Use native Alert on mobile/tablet
    Alert.alert(title, message, buttons, options);
  }
};

// Provider component to include in your app
export const CustomAlertProvider = ({ children }) => {
  return (
    <>
      {children}
      {Platform.OS === 'web' && <CustomAlertModal />}
    </>
  );
};

// Styles for web modal (similar to Android alerts)
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 20,
    minWidth: 280,
    maxWidth: 400,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },

  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 12,
    textAlign: 'left',
  },

  message: {
    fontSize: 16,
    color: '#000000',
    lineHeight: 24,
    marginBottom: 20,
    textAlign: 'left',
  },

  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },

  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 4,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },

  defaultButton: {
    backgroundColor: 'transparent',
  },

  cancelButton: {
    backgroundColor: 'transparent',
  },

  destructiveButton: {
    backgroundColor: 'transparent',
  },

  buttonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196F3',
    textTransform: 'uppercase',
  },

  destructiveText: {
    color: '#F44336',
  },
});

export default CustomAlertModal;