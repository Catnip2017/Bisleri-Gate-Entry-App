import schedule
import time
import subprocess
from datetime import datetime

LOG_FILE = "scheduler_log.txt"

def log(msg):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(LOG_FILE, "a") as f:
        f.write(f"[{timestamp}] {msg}\n")
    print(f"[{timestamp}] {msg}")

def job():
    log("Running csv_to_DB.py to push data from mfabric tables...")
    result = subprocess.run(["python", "csv_to_DB.py"], capture_output=True, text=True)
    
    if result.returncode == 0:
        log("csv_to_DB.py completed successfully. document_data table updated.")
    else:
        log(f"Error in csv_to_DB.py:\n{result.stderr}")

# Run immediately once
job()

# Then schedule every 10 minutes
schedule.every(10).minutes.do(job)
log("Scheduler started. Will run every 10 minutes.")

while True:
    schedule.run_pending()
    time.sleep(10)
