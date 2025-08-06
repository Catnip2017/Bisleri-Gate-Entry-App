import schedule
import time
from datetime import datetime
from app.services.db_service import DBService

LOG_FILE = "document_sync_log.txt"

def log(msg):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(LOG_FILE, "a") as f:
        f.write(f"[{timestamp}] {msg}\n")
    print(f"[{timestamp}] {msg}")

def job():
    log("🚀 Running document_data consolidation...")

    try:
        db_service = DBService()
        result = db_service.push_to_document_data()
        if result:
            count = db_service.get_document_data_count()
            log(f"✅ Consolidation successful. Total document_data rows: {count}")
        else:
            log("⚠️ Consolidation failed.")
    except Exception as e:
        log(f"❌ Error during consolidation: {str(e)}")

# Run once immediately
job()

# Then every 20 minutes
schedule.every(20).minutes.do(job)
log("⏱️ Scheduler started. Will run every 20 minutes.")

while True:
    schedule.run_pending()
    time.sleep(10)
