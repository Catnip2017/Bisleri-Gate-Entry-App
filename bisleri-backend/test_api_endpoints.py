# test_api_endpoints.py
import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8000"  # Using localhost since server is running locally
TEST_USER = "testuser"
TEST_PASSWORD = "test123"

def print_response(response, endpoint_name):
    """Pretty print API response"""
    print(f"\n📡 {endpoint_name}")
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        print("✅ SUCCESS")
    elif response.status_code == 401:
        print("🔐 UNAUTHORIZED")
    elif response.status_code == 404:
        print("🔍 NOT FOUND")
    elif response.status_code == 422:
        print("📝 VALIDATION ERROR")
    else:
        print("❌ ERROR")
    
    try:
        response_data = response.json()
        print("Response:", json.dumps(response_data, indent=2, default=str))
    except:
        print("Response:", response.text)
    
    print("-" * 50)

def test_health_check():
    """Test basic health check endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/", timeout=10)
        print_response(response, "Health Check (GET /)")
        return response.status_code == 200
    except requests.exceptions.RequestException as e:
        print(f"❌ Health check failed: {e}")
        return False

def test_login(username=TEST_USER, password=TEST_PASSWORD):
    """Test login endpoint and return access token"""
    try:
        login_data = {
            "username": username,
            "password": password
        }
        
        response = requests.post(
            f"{BASE_URL}/login",
            json=login_data,
            timeout=10
        )
        
        print_response(response, f"Login (POST /login)")
        
        if response.status_code == 200:
            token_data = response.json()
            return token_data.get("access_token")
        else:
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Login test failed: {e}")
        return None

def test_protected_endpoint(access_token, endpoint, method="GET", data=None):
    """Test a protected endpoint with authorization"""
    try:
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        if method == "GET":
            response = requests.get(f"{BASE_URL}{endpoint}", headers=headers, timeout=10)
        elif method == "POST":
            response = requests.post(f"{BASE_URL}{endpoint}", headers=headers, json=data, timeout=10)
        
        print_response(response, f"{method} {endpoint}")
        return response.status_code == 200
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Protected endpoint test failed: {e}")
        return False

def test_gate_operations(access_token):
    """Test gate-related endpoints"""
    print("\n🚪 Testing Gate Operations...")
    
    # Test getting documents by vehicle (this might fail if no test data)
    test_protected_endpoint(access_token, "/documents/TEST123", "GET")
    
    # Test creating gate entry (this might fail without valid document)
    gate_entry_data = {
        "gate_type": "Gate-Out",
        "vehicle_no": "TEST123",
        "remarks": "Test gate entry"
    }
    test_protected_endpoint(access_token, "/gate-entry", "POST", gate_entry_data)

def test_insights_endpoints(access_token):
    """Test insights endpoints"""
    print("\n📊 Testing Insights...")
    
    # Test dashboard stats
    test_protected_endpoint(access_token, "/dashboard-stats", "GET")
    
    # Test vehicle movements
    movements_filter = {
        "from_date": "2024-01-01T00:00:00",
        "to_date": "2024-12-31T23:59:59"
    }
    test_protected_endpoint(access_token, "/vehicle-movements", "POST", movements_filter)

def test_admin_endpoints(access_token):
    """Test admin endpoints (might fail if test user is not admin)"""
    print("\n👑 Testing Admin Operations...")
    
    # Test list users
    test_protected_endpoint(access_token, "/list-users", "GET")

def main():
    """Run comprehensive API tests"""
    print("🚀 Starting API Endpoint Tests...")
    print("=" * 60)
    print(f"Testing against: {BASE_URL}")
    print("=" * 60)
    
    # Test 1: Health Check
    print("\n🏥 Testing Basic Connectivity...")
    if not test_health_check():
        print("❌ Server is not reachable. Make sure your FastAPI server is running.")
        print("\nTo start the server:")
        print("  cd /path/to/your/backend")
        print("  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000")
        return
    
    # Test 2: Login
    print("\n🔐 Testing Authentication...")
    access_token = test_login()
    
    if not access_token:
        print(f"❌ Login failed with {TEST_USER}/{TEST_PASSWORD}")
        print("\nTroubleshooting:")
        print("  1. Check if test user exists in database")
        print("  2. Verify password is correct")
        print("  3. Run the database test script first")
        
        # Try alternative login credentials
        print("\n🔄 Trying with different credentials...")
        alt_username = input("Enter a known username (or press Enter to skip): ").strip()
        if alt_username:
            alt_password = input("Enter password: ").strip()
            access_token = test_login(alt_username, alt_password)
    
    if not access_token:
        print("❌ Cannot proceed with protected endpoint tests without valid token")
        return
    
    print(f"✅ Login successful! Token: {access_token[:20]}...")
    
    # Test 3: Protected Endpoints
    print("\n🔒 Testing Protected Endpoints...")
    
    # Basic protected endpoints
    test_gate_operations(access_token)
    test_insights_endpoints(access_token)
    test_admin_endpoints(access_token)
    
    # Test logout
    test_protected_endpoint(access_token, "/logout", "POST")
    
    print("\n" + "=" * 60)
    print("📋 API TEST SUMMARY")
    print("=" * 60)
    print("✅ If most tests passed, your API is working correctly!")
    print("❌ If tests failed, check the error messages above")
    print("\n📱 Next Steps for Frontend Integration:")
    print("  1. Update your React Native app's API_BASE_URL")
    print(f"  2. Use these credentials for testing: {TEST_USER}/{TEST_PASSWORD}")
    print("  3. Test login from your mobile app")

if __name__ == "__main__":
    main()