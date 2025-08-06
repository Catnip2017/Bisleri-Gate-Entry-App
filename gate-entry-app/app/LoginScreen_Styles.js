import { StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E0F7FA',
    paddingTop: height * 0.1,
    paddingHorizontal: width * 0.05,
  },
  topLogo: {
    width: 120,
    height: 55,
    resizeMode: 'contain',
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
    boxShadow: '0px 2px 4px rgba(0,0,0,0.3)',
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  logoSmall: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
    marginRight: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
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
});

export default styles;