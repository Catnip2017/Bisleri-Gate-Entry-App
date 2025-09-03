# app/utils/helpers.py - UPDATED with dual table check for gate entry numbers
import string
import random
from datetime import datetime
import psycopg2
from app.config import settings

def get_connection():
    """Get database connection using raw psycopg2"""
    return psycopg2.connect(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        database=settings.DB_NAME,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD
    )

def fetch_user_details(username):
    """Fetch fresh user details from users_master table"""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT username, site_code, warehouse_code, warehouse_name
            FROM users_master
            WHERE username = %s
        """, (username,))
        result = cursor.fetchone()
        
        if result:
            return {
                "username": result[0],
                "site_code": result[1],
                "warehouse_code": result[2],
                "warehouse_name": result[3]
            }
        return None
    except Exception as e:
        print(f"Error fetching user details: {str(e)}")
        return None
    finally:
        cursor.close()
        conn.close()

def check_gate_entry_exists(gate_entry_no):
    """Check if gate entry number exists in either insights_data or raw_materials_data"""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Check insights_data table
        cursor.execute("""
            SELECT 1 FROM insights_data WHERE gate_entry_no = %s
            UNION
            SELECT 1 FROM raw_materials_data WHERE gate_entry_no = %s
            LIMIT 1
        """, (gate_entry_no, gate_entry_no))
        result = cursor.fetchone()
        return result is not None 
    
    except Exception as e:
        print(f"Error checking gate entry existence: {str(e)}")
        return True  # Assume exists to be safe
    finally:
        cursor.close()
        conn.close()

def generate_gate_entry_number(warehouse_code):
    """Generate gate entry number with warehouse validation and dual table check"""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Validate warehouse_code exists in location_master
        cursor.execute("""
            SELECT warehouse_code FROM location_master WHERE warehouse_code = %s
        """, (warehouse_code,))
        result = cursor.fetchone()
        
        if not result:
            print(f"Warehouse code {warehouse_code} not found in location_master")
            return None
            
        warehouse_id = result[0]
        year = datetime.now().strftime("%Y")
        
        # Generate unique gate entry number by checking both tables
        max_attempts = 100  # Prevent infinite loop
        for attempt in range(max_attempts):
            random_digits = ''.join(random.choices(string.digits, k=6))
            gate_entry_no = f"{warehouse_id}{year}{random_digits}"
            
            # Check if this number exists in either table
            if not check_gate_entry_exists(gate_entry_no):
                return gate_entry_no
        
        print(f"Failed to generate unique gate entry number after {max_attempts} attempts")
        return None
        
    except Exception as e:
        print(f"Error generating gate entry number: {str(e)}")
        return None
    finally:
        cursor.close()
        conn.close()

def generate_gate_entry_no_for_user(username):
    """
    Complete function to generate gate entry number for a user
    Now checks both insights_data and raw_materials_data for uniqueness
    """
    try:
        # Step 1: Get fresh user details
        user_details = fetch_user_details(username)
        if not user_details:
            print(f"User {username} not found in database")
            return None
            
        warehouse_code = user_details.get('warehouse_code')
        if not warehouse_code:
            print(f"User {username} has no warehouse_code assigned")
            return None
            
        # Step 2: Generate gate entry number with dual table check
        gate_entry_no = generate_gate_entry_number(warehouse_code)
        if not gate_entry_no:
            print(f"Failed to generate gate entry number for warehouse {warehouse_code}")
            return None
            
        return gate_entry_no
        
    except Exception as e:
        print(f"Error in generate_gate_entry_no_for_user: {str(e)}")
        return None

# Legacy function for backward compatibility
def generate_gate_entry_no(warehouse_code: str = "ATDVG") -> str:
    """Legacy function - use generate_gate_entry_no_for_user instead"""
    result = generate_gate_entry_number(warehouse_code)
    return result if result else f"ATDVG{datetime.now().strftime('%Y')}{''.join(random.choices(string.digits, k=6))}"

def validate_document_date(date_str: str) -> bool:
    """Validate document date format"""
    try:
        datetime.strptime(date_str, "%Y-%m-%dT%H:%M:%S.%fZ")
        return True
    except ValueError:
        return False

def clean_vehicle_number(vehicle_no: str) -> str:
    """Clean and standardize vehicle number format"""
    if not vehicle_no:
        return ""
    
    cleaned = vehicle_no.strip().upper()
    cleaned = ''.join(char for char in cleaned if char.isalnum())
    return cleaned

def validate_vehicle_number(vehicle_no: str) -> bool:
    """Validate Indian vehicle number format"""
    if not vehicle_no:
        return False
    
    cleaned = clean_vehicle_number(vehicle_no)
    
    if len(cleaned) < 8 or len(cleaned) > 15:
        return False
    
    if not cleaned[:2].isalpha():
        return False
    
    return True

def parse_date_string(date_str: str) -> datetime:
    """Parse date string in various formats"""
    if not date_str:
        return datetime.now()
    
    formats = [
        "%Y-%m-%d",
        "%d/%m/%Y", 
        "%d-%m-%Y",
        "%Y-%m-%d %H:%M:%S",
        "%d/%m/%Y %H:%M:%S"
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            continue
    
    return datetime.now()

def generate_error_code():
    """Generate unique error tracking code"""
    timestamp = datetime.now().strftime("%H%M%S")
    random_part = ''.join(random.choices(string.digits, k=3))
    return f"ERR-{timestamp}-{random_part}"

def clean_string(text: str) -> str:
    """Clean and normalize string input"""
    if not text:
        return ""
    
    return text.strip().replace('\n', ' ').replace('\r', '')

# ✅ TEST THE RAW SQL FUNCTIONS
if __name__ == "__main__":
    print("Testing Raw SQL Gate Entry Number Generation:")
    print("=" * 60)
    
    # Test user details fetch
    test_username = "testuser"  # Replace with actual username
    user_details = fetch_user_details(test_username)
    print(f"User Details for {test_username}:")
    print(f"  Result: {user_details}")
    
    if user_details and user_details.get('warehouse_code'):
        warehouse_code = user_details['warehouse_code']
        print(f"\nTesting gate entry generation for warehouse: {warehouse_code}")
        
        # Test gate entry number generation
        for i in range(3):
            gate_no = generate_gate_entry_number(warehouse_code)
            print(f"  Generated: {gate_no}")