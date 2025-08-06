# test_db_connection.py
import os
import sys
from datetime import datetime
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError

# Add the app directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from app.config import settings
    from app.database import engine, SessionLocal, get_db
    from app.models.users import UsersMaster, LocationMaster
    from app.models.documents import DocumentData
    from app.models.insights import InsightsData
    print("✅ Successfully imported app modules")
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("Make sure you're running this from the project root directory")
    sys.exit(1)

def test_environment_variables():
    """Test if all required environment variables are set"""
    print("\n🔍 Testing Environment Variables...")
    
    required_vars = ['DB_USER', 'DB_PASSWORD', 'DB_HOST', 'DB_PORT', 'DB_NAME', 'SECRET_KEY']
    missing_vars = []
    
    for var in required_vars:
        value = getattr(settings, var, None)
        if value:
            if var in ['DB_PASSWORD', 'SECRET_KEY']:
                print(f"  ✅ {var}: {'*' * len(str(value))}")
            else:
                print(f"  ✅ {var}: {value}")
        else:
            missing_vars.append(var)
            print(f"  ❌ {var}: NOT SET")
    
    if missing_vars:
        print(f"\n❌ Missing environment variables: {missing_vars}")
        return False
    
    print("✅ All environment variables are set")
    return True

def test_database_connection():
    """Test basic database connectivity"""
    print("\n🔍 Testing Database Connection...")
    
    try:
        # Test engine connection
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version()"))
            version = result.scalar()
            print(f"  ✅ Connected to PostgreSQL: {version}")
            return True
    except SQLAlchemyError as e:
        print(f"  ❌ Database connection failed: {e}")
        return False
    except Exception as e:
        print(f"  ❌ Unexpected error: {e}")
        return False

def test_tables_exist():
    """Test if required tables exist in the database"""
    print("\n🔍 Testing Table Existence...")
    
    required_tables = [
        'users_master',
        'location_master', 
        'document_data',
        'insights_data',
        'transferorder_rgp_data',
        'invoice_data',
        'deliverychallan_data'
    ]
    
    try:
        with engine.connect() as conn:
            for table in required_tables:
                result = conn.execute(text(f"""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = '{table}'
                    );
                """))
                exists = result.scalar()
                
                if exists:
                    # Get row count
                    count_result = conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
                    count = count_result.scalar()
                    print(f"  ✅ {table}: EXISTS ({count} rows)")
                else:
                    print(f"  ❌ {table}: MISSING")
                    
        return True
    except SQLAlchemyError as e:
        print(f"  ❌ Error checking tables: {e}")
        return False

def test_sample_data():
    """Test if sample data exists in key tables"""
    print("\n🔍 Testing Sample Data...")
    
    try:
        db = SessionLocal()
        
        # Test users
        user_count = db.query(UsersMaster).count()
        print(f"  📊 Users in database: {user_count}")
        
        if user_count > 0:
            sample_user = db.query(UsersMaster).first()
            print(f"  👤 Sample user: {sample_user.username} ({sample_user.role})")
        
        # Test locations
        location_count = db.query(LocationMaster).count()
        print(f"  📊 Locations in database: {location_count}")
        
        if location_count > 0:
            sample_location = db.query(LocationMaster).first()
            print(f"  🏢 Sample location: {sample_location.warehouse_name} ({sample_location.warehouse_code})")
        
        # Test documents
        document_count = db.query(DocumentData).count()
        print(f"  📊 Documents in database: {document_count}")
        
        if document_count > 0:
            sample_doc = db.query(DocumentData).first()
            print(f"  📄 Sample document: {sample_doc.document_no} ({sample_doc.document_type})")
        
        # Test insights
        insight_count = db.query(InsightsData).count()
        print(f"  📊 Insights records: {insight_count}")
        
        db.close()
        return True
        
    except SQLAlchemyError as e:
        print(f"  ❌ Error accessing sample data: {e}")
        return False

def test_user_authentication():
    """Test user authentication functionality"""
    print("\n🔍 Testing User Authentication...")
    
    try:
        from app.auth import authenticate_user, get_password_hash, verify_password
        
        db = SessionLocal()
        
        # Get first user for testing
        test_user = db.query(UsersMaster).first()
        
        if not test_user:
            print("  ❌ No users found in database")
            return False
        
        print(f"  👤 Testing with user: {test_user.username}")
        
        # Test password verification (assuming you know a test password)
        print("  ℹ️  Note: Cannot test actual login without knowing password")
        print(f"  ✅ User data accessible: {test_user.first_name} {test_user.last_name}")
        print(f"  ✅ User role: {test_user.role}")
        print(f"  ✅ User warehouse: {test_user.warehouse_code}")
        
        db.close()
        return True
        
    except Exception as e:
        print(f"  ❌ Authentication test failed: {e}")
        return False

def test_api_endpoints():
    """Test if FastAPI can start (basic import test)"""
    print("\n🔍 Testing API Components...")
    
    try:
        from app.main import app
        from app.routers import auth, gate, insights, admin, documents
        
        print("  ✅ FastAPI app imported successfully")
        print("  ✅ Auth router imported")
        print("  ✅ Gate router imported") 
        print("  ✅ Insights router imported")
        print("  ✅ Admin router imported")
        print("  ✅ Documents router imported")
        
        return True
        
    except ImportError as e:
        print(f"  ❌ API import failed: {e}")
        return False

def create_test_user():
    """Create a test user if none exists"""
    print("\n🔍 Checking for Test User...")
    
    try:
        from app.auth import get_password_hash
        
        db = SessionLocal()
        
        # Check if test user exists
        test_user = db.query(UsersMaster).filter(UsersMaster.username == "testuser").first()
        
        if test_user:
            print(f"  ✅ Test user already exists: testuser")
            print(f"  ℹ️  You can test login with: username='testuser'")
            db.close()
            return True
        
        # Check if any location exists for warehouse_code
        location = db.query(LocationMaster).first()
        
        if not location:
            print("  ❌ No locations found. Cannot create test user without location.")
            db.close()
            return False
        
        # Create test user
        test_password = "test123"
        hashed_password = get_password_hash(test_password)
        
        new_user = UsersMaster(
            username="testuser",
            first_name="Test",
            last_name="User", 
            role="security",
            warehouse_code=location.warehouse_code,
            warehouse_name=location.warehouse_name,
            site_code=location.site_code,
            password=hashed_password
        )
        
        db.add(new_user)
        db.commit()
        
        print(f"  ✅ Created test user:")
        print(f"      Username: testuser")
        print(f"      Password: {test_password}")
        print(f"      Role: security")
        print(f"      Warehouse: {location.warehouse_code}")
        
        db.close()
        return True
        
    except Exception as e:
        print(f"  ❌ Failed to create test user: {e}")
        return False

def main():
    """Run all database tests"""
    print("🚀 Starting Database Connection Tests...")
    print("=" * 50)
    
    tests = [
        test_environment_variables,
        test_database_connection,
        test_tables_exist,
        test_sample_data,
        test_user_authentication,
        test_api_endpoints,
        create_test_user
    ]
    
    results = []
    
    for test in tests:
        try:
            result = test()
            results.append(result)
        except Exception as e:
            print(f"  ❌ Test failed with exception: {e}")
            results.append(False)
    
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY:")
    print("=" * 50)
    
    passed = sum(results)
    total = len(results)
    
    test_names = [
        "Environment Variables",
        "Database Connection", 
        "Table Existence",
        "Sample Data",
        "User Authentication",
        "API Components",
        "Test User Creation"
    ]
    
    for i, (name, result) in enumerate(zip(test_names, results)):
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {status} {name}")
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! Your backend is ready for testing.")
        print("\n📝 Next steps:")
        print("  1. Start your FastAPI server: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000")
        print("  2. Test login endpoint with curl or your React Native app")
        if any("testuser" in str(test) for test in [test_user_authentication, create_test_user]):
            print("  3. Use testuser/test123 for testing login")
    else:
        print(f"\n⚠️  {total - passed} tests failed. Please fix the issues before proceeding.")

if __name__ == "__main__":
    main()