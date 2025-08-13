// app/LoginScreen_Styles.js - Fixed deprecated style properties
import { StyleSheet, Dimensions, Platform } from 'react-native';

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // minHeight: '100%',
    backgroundColor: '#E0F7FA',
    paddingTop: height * 0.1,
    paddingHorizontal: width * 0.05,
  },
  topLogo: {
    width: 120,
    height: 55,
    marginBottom: 40,
    alignSelf: 'flex-start',
  },
  loginBox: {
    alignSelf: 'center',
    width: '95%',
    maxWidth: 500,
    borderRadius: 10,
    padding: 30,
    backgroundColor: '#fff',
    // Fixed: Use platform-specific shadow styles
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 10,
      },
      web: {
        boxShadow: '0px 2px 4px rgba(0,0,0,0.3)',
      },
    }),
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  logoSmall: {
    width: 40,
    height: 40,
    marginRight: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
    // Fixed: Use platform-specific text shadow
    ...Platform.select({
      ios: {
        textShadowColor: 'rgba(0,0,0,0.1)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 1,
      },
      android: {
        textShadowColor: 'rgba(0,0,0,0.1)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 1,
      },
      web: {
        textShadow: '0px 1px 1px rgba(0,0,0,0.1)',
      },
    }),
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  label: {
    width: 110,
    fontWeight: 'bold',
    fontSize: 16,
    color: '#111',
  },
  input: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#555',
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#000',
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 18,
  },
  // Separate shadow style for button to avoid duplication
  buttonShadow: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
    },
    android: {
      elevation: 4,
    },
    web: {
      boxShadow: '0px 2px 4px rgba(0,0,0,0.3)',
    },
  }),
});

export default styles;