# debug_routes.py
import requests
import sys

BASE_URL = "http://localhost:8000"

def check_routes():
    """Check what routes are available"""
    print("🔍 Checking Available Routes...")
    
    try:
        # FastAPI automatically generates OpenAPI docs
        response = requests.get(f"{BASE_URL}/docs", timeout=5)
        if response.status_code == 200:
            print("✅ FastAPI docs available at: http://localhost:8000/docs")
        
        # Check OpenAPI JSON
        response = requests.get(f"{BASE_URL}/openapi.json", timeout=5)
        if response.status_code == 200:
            openapi_data = response.json()
            print("\n📋 Available Endpoints:")
            
            paths = openapi_data.get("paths", {})
            for path, methods in paths.items():
                for method in methods.keys():
                    if method.upper() in ['GET', 'POST', 'PUT', 'DELETE']:
                        print(f"  {method.upper()} {path}")
        
    except Exception as e:
        print(f"❌ Error checking routes: {e}")

def test_auth_variations():
    """Test different auth endpoint variations"""
    print("\n🔐 Testing Auth Endpoint Variations...")
    
    test_data = {"username": "testuser", "password": "test123"}
    
    auth_endpoints = [
        "/auth/login",
        "/login", 
        "/auth/token",
        "/token"
    ]
    
    for endpoint in auth_endpoints:
        try:
            print(f"\n🔗 Testing: {endpoint}")
            response = requests.post(f"{BASE_URL}{endpoint}", json=test_data, timeout=5)
            print(f"   Status: {response.status_code}")
            
            if response.status_code == 200:
                print(f"   ✅ SUCCESS!")
                try:
                    data = response.json()
                    if "access_token" in data:
                        print(f"   🔑 Token received!")
                        return endpoint, data["access_token"]
                except:
                    pass
            elif response.status_code == 404:
                print(f"   🔍 NOT FOUND")
            elif response.status_code == 422:
                print(f"   📝 VALIDATION ERROR")
                try:
                    error_data = response.json()
                    print(f"   Error details: {error_data}")
                except:
                    pass
            else:
                print(f"   ❌ Error: {response.status_code}")
                
        except Exception as e:
            print(f"   ❌ Request failed: {e}")
    
    return None, None

def check_main_py_setup():
    """Check if main.py router setup is correct"""
    print("\n🔧 Checking main.py Router Setup...")
    
    try:
        # Import your app to check router setup
        sys.path.append('.')
        from app.main import app
        
        print("✅ App imported successfully")
        
        # Check if routes are registered
        routes = []
        for route in app.routes:
            if hasattr(route, 'path') and hasattr(route, 'methods'):
                for method in route.methods:
                    if method in ['GET', 'POST', 'PUT', 'DELETE']:
                        routes.append(f"{method} {route.path}")
        
        print(f"\n📋 Registered Routes ({len(routes)}):")
        for route in sorted(routes):
            print(f"  {route}")
            
        # Check specifically for auth routes
        auth_routes = [r for r in routes if 'auth' in r.lower() or 'login' in r.lower()]
        print(f"\n🔐 Auth Routes Found: {len(auth_routes)}")
        for route in auth_routes:
            print(f"  {route}")
            
    except Exception as e:
        print(f"❌ Error checking main.py: {e}")

def main():
    print("🚀 FastAPI Route Debugging...")
    print("=" * 50)
    
    # Check basic connectivity
    try:
        response = requests.get(f"{BASE_URL}/", timeout=5)
        if response.status_code == 200:
            print("✅ Server is reachable")
        else:
            print(f"❌ Server returned: {response.status_code}")
            return
    except Exception as e:
        print(f"❌ Server not reachable: {e}")
        return
    
    # Debug steps
    check_routes()
    check_main_py_setup()
    endpoint, token = test_auth_variations()
    
    print("\n" + "=" * 50)
    print("🎯 DEBUGGING SUMMARY")
    print("=" * 50)
    
    if endpoint and token:
        print(f"✅ Working auth endpoint: {endpoint}")
        print(f"✅ Token obtained: {token[:20]}...")
    else:
        print("❌ No working auth endpoint found")
        print("\n🔧 Possible Issues:")
        print("  1. Router not properly included in main.py")
        print("  2. Auth router path prefix issue")
        print("  3. Missing dependencies in auth router")
        
        print("\n💡 Solutions:")
        print("  1. Check your main.py router includes")
        print("  2. Visit http://localhost:8000/docs to see available endpoints")
        print("  3. Check for import errors in auth router")

if __name__ == "__main__":
    main()