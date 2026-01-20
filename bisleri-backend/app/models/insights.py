# app/models/insights.py - UPDATED WITH OPERATIONAL FIELDS
from sqlalchemy import Column, Integer, String, DateTime, Text, Time
from app.database import Base

class InsightsData(Base):
    __tablename__ = "insights_data" 
    id = Column(Integer, primary_key=True, autoincrement=True)
    gate_entry_no = Column(String(50))
    document_type = Column(String(50))
    sub_document_type = Column(String(50))
    document_no = Column(String(100))
    vehicle_no = Column(String(50))
    warehouse_name = Column(String(100))
    date = Column(DateTime)
    time = Column(Time)
    movement_type = Column(String(20))
    remarks = Column(Text)
    warehouse_code = Column(String(50))
    site_code = Column(String(50))
    security_name = Column(String(255))
    security_username = Column(String(255))
    document_date = Column(DateTime)
    
    # ✅ NEW: Operational fields for the 3-color edit system
    driver_name = Column(String(100))           # Required for completion
    km_reading = Column(String(10))             # Required for completion (KM IN/OUT)
    loader_names = Column(String(200))          # Required for completion (comma-separated)
    last_edited_at = Column(DateTime)           # Track edit timestamps
    edit_count = Column(Integer, default=0)     # Track number of edits
    
    def __repr__(self):
        return f"<InsightsData(gate_entry_no='{self.gate_entry_no}', vehicle_no='{self.vehicle_no}')>"
    
    # ✅ NEW: Helper methods for edit status
    def is_operational_data_complete(self):
        """Check if all required operational fields are filled"""
        return all([
            self.driver_name and self.driver_name.strip(),
            self.km_reading and self.km_reading.strip(),
            self.loader_names and self.loader_names.strip()
        ])
    
    def get_edit_status(self):
        """Get the current edit status for the 3-color system"""
        from datetime import datetime, timedelta
        
        if not self.date or not self.time:
            return 'expired'
            
        # Calculate time since record creation
        record_datetime = datetime.combine(self.date, self.time)
        time_elapsed = datetime.now() - record_datetime
        
        # Check if 24-hour window has passed
        if time_elapsed > timedelta(hours=24):
            return 'expired'  # BLACK button
        
        # Check if operational data is complete
        if not self.is_operational_data_complete():
            return 'needs_completion'  # YELLOW button
        
        # All data complete and within window
        return 'editable'  # GREEN button
    
    def get_time_remaining(self):
        """Get remaining time in the 24-hour edit window"""
        from datetime import datetime, timedelta
        
        if not self.date or not self.time:
            return None
            
        record_datetime = datetime.combine(self.date, self.time)
        time_elapsed = datetime.now() - record_datetime
        time_remaining = timedelta(hours=24) - time_elapsed
        
        if time_remaining.total_seconds() <= 0:
            return None
            
        hours = int(time_remaining.total_seconds() // 3600)
        minutes = int((time_remaining.total_seconds() % 3600) // 60)
        
        return f"{hours}h {minutes}m"
    
    def can_be_edited(self, current_user_username, current_user_role):
        """Check if record can be edited by the given user"""
        # Must be within 24-hour window
        if self.get_edit_status() == 'expired':
            return False
        
        # Admin can edit any record
        if current_user_role == 'Admin':
            return True
        
        # Creator can edit their own record
        return self.security_username == current_user_username
    
    def get_missing_operational_fields(self):
        """Get list of missing operational fields"""
        missing = []
        
        if not (self.driver_name and self.driver_name.strip()):
            missing.append('driver_name')
        
        if not (self.km_reading and self.km_reading.strip()):
            missing.append('km_reading')
        
        if not (self.loader_names and self.loader_names.strip()):
            missing.append('loader_names')
        
        return missing
    
    def get_edit_button_config(self, current_user_username, current_user_role):
        """Get the complete button configuration for frontend"""
        edit_status = self.get_edit_status()
        can_edit = self.can_be_edited(current_user_username, current_user_role)
        time_remaining = self.get_time_remaining()
        missing_fields = self.get_missing_operational_fields()
        
        if edit_status == 'expired':
            return {
                'color': 'black',
                'text': '⚫ Expired',
                'enabled': False,
                'priority': 'none',
                'message': 'Edit window expired (24+ hours)',
                'action': 'view_only'
            }
        
        if not can_edit:
            return {
                'color': 'gray',
                'text': '🚫 No Access',
                'enabled': False,
                'priority': 'none',
                'message': 'Only creator or admin can edit',
                'action': 'no_access'
            }
        
        if edit_status == 'needs_completion':
            return {
                'color': 'yellow',
                'text': '⚠️ Complete Info',
                'enabled': True,
                'priority': 'high',
                'message': f'Missing: {", ".join(missing_fields)} | {time_remaining} remaining',
                'action': 'complete_required',
                'missing_fields': missing_fields
            }
        
        # edit_status == 'editable'
        return {
            'color': 'green',
            'text': '✅ Edit Details',
            'enabled': True,
            'priority': 'medium',
            'message': f'All data complete | {time_remaining} remaining',
            'action': 'edit_optional',
            'edit_count': self.edit_count or 0
        }