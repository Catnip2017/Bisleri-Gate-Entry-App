from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class DocumentResponse(BaseModel):
    document_no: str
    document_type: str
    document_date: datetime
    vehicle_no: str
    warehouse_name: str
    customer_name: Optional[str] = None
    total_quantity: float
    e_way_bill_no: Optional[str] = None
    from_warehouse_code: Optional[str] = None
    to_warehouse_code: Optional[str] = None
    sub_document_type: Optional[str] = None
    salesman: Optional[str] = None
