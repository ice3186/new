# Setup Guide - EMR Care Gap Monitoring System

This guide will walk you through setting up the EMR Care Gap Monitoring System step by step.

## Step 1: System Requirements

Ensure you have:
- Python 3.11 or higher
- pip (Python package installer)
- Internet connection
- A text editor

Check your Python version:
```bash
python --version
# or
python3 --version
```

## Step 2: Install Dependencies

Navigate to the project directory and install required packages:

```bash
cd new
pip install -r requirements.txt
```

If you encounter permission issues, use:
```bash
pip install --user -r requirements.txt
```

## Step 3: Get Elation Health API Access

### For Development/Testing:

1. **Register for Developer Sandbox**:
   - Go to: https://www.elationhealth.com/contact-us/sandbox/
   - Fill out the registration form
   - Provide details about your use case

2. **Wait for Approval**:
   - Elation will review your request
   - You'll receive API credentials via email
   - This usually takes 1-3 business days

3. **Credentials You'll Receive**:
   - API Key
   - API Secret
   - Base URL (typically https://sandbox.elationhealth.com for testing)
   - Sample patient ID for testing

### For Production Use:

1. Contact Elation Health support
2. Request production API access
3. Complete any required agreements
4. Obtain production credentials

## Step 4: Configure Environment Variables

1. **Copy the example environment file**:
   ```bash
   cp .env.example .env
   ```

2. **Edit the `.env` file**:
   ```bash
   nano .env
   # or use your preferred editor
   ```

3. **Add your Elation Health credentials**:
   ```env
   ELATION_API_KEY=your_actual_api_key_here
   ELATION_API_SECRET=your_actual_api_secret_here
   ELATION_BASE_URL=https://sandbox.elationhealth.com
   ELATION_PATIENT_ID=your_patient_id_here
   ```

4. **Configure email alerts** (required for email notifications):

   For Gmail:
   ```env
   ALERT_EMAIL_FROM=your_email@gmail.com
   ALERT_EMAIL_TO=your_email@gmail.com
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USERNAME=your_email@gmail.com
   SMTP_PASSWORD=your_app_password
   ```

   **Important**: For Gmail, you need to generate an App Password:
   - Go to Google Account settings
   - Security > 2-Step Verification
   - App passwords
   - Generate a new app password for "Mail"
   - Use this password in SMTP_PASSWORD

   For other email providers, adjust SMTP settings accordingly.

5. **Configure SMS alerts** (optional):

   If you want SMS notifications via Twilio:
   ```env
   TWILIO_ACCOUNT_SID=your_twilio_account_sid
   TWILIO_AUTH_TOKEN=your_twilio_auth_token
   TWILIO_FROM_NUMBER=+1234567890
   TWILIO_TO_NUMBER=+1234567890
   ```

   To get Twilio credentials:
   - Sign up at https://www.twilio.com/
   - Get a phone number
   - Find your Account SID and Auth Token in the console

## Step 5: Test the Connection

Test your Elation Health API connection:

```bash
python main.py test
```

Expected output:
```
2025-10-21 09:00:00 - INFO - Initializing EMR Care Gap Monitor...
2025-10-21 09:00:00 - INFO - Initialization complete
2025-10-21 09:00:00 - INFO - Testing connection to Elation Health API...
2025-10-21 09:00:00 - INFO - Successfully connected to Elation Health API
2025-10-21 09:00:00 - INFO - API connection test: SUCCESS
```

If you see errors:
- Check your API credentials
- Verify the base URL is correct
- Ensure you have internet connectivity
- Review the logs in `care_gap_monitor.log`

## Step 6: Customize Care Gap Rules

1. **Review the default rules**:
   ```bash
   python main.py rules
   ```

2. **Edit rules to match your needs**:
   ```bash
   nano care_gap_rules.yaml
   ```

3. **Customize for your health conditions**:
   - Enable/disable rules by setting `enabled: true/false`
   - Adjust `max_days_since_last` for different frequencies
   - Modify `applies_to_conditions` to match your diagnoses
   - Change `alert_priority` based on importance

4. **Example customization**:
   ```yaml
   # If you have diabetes, make sure this rule is enabled:
   - id: diabetes_hba1c_monitoring
     name: Diabetes HbA1c Monitoring
     type: lab_work
     description: Quarterly HbA1c testing for diabetes management
     enabled: true  # Make sure this is true if you have diabetes
     conditions:
       lab_test_code: "4548-4"
       max_days_since_last: 90
       applies_to_conditions:
         - "diabetes mellitus"
         - "type 2 diabetes"
     alert_priority: high
   ```

## Step 7: Configure Alert Settings

Edit the alert settings in `care_gap_rules.yaml`:

```yaml
alert_settings:
  # Set your quiet hours (no alerts during sleep)
  quiet_hours_start: "22:00"  # 10 PM
  quiet_hours_end: "08:00"    # 8 AM

  # How often to repeat reminders
  reminder_frequency_days:
    high: 3      # High priority: every 3 days
    medium: 7    # Medium priority: weekly
    low: 14      # Low priority: bi-weekly

  # Which alert methods to use
  methods:
    - email
    # Uncomment the line below if you configured SMS:
    # - sms
```

## Step 8: Run Your First Check

Run a manual care gap check:

```bash
python main.py check
```

This will:
1. Connect to Elation Health API
2. Retrieve your medical records
3. Check all enabled rules
4. Display detected care gaps
5. Send alerts if gaps are found

## Step 9: Review the Results

Check the output for detected care gaps:

```
============================================================
Starting care gap check...
============================================================
2025-10-21 09:00:00 - INFO - Loaded 14 care gap rules
2025-10-21 09:00:00 - INFO - Detected care gap: CareGap(Annual Cholesterol Screening, priority=medium, days_overdue=45)

Detected 1 care gap(s):
------------------------------------------------------------

MEDIUM PRIORITY (1):
  - Annual Cholesterol Screening
    Type: lab_work
    Days overdue: 45
    Message: Your annual cholesterol screening is due. Last test was over a year ago.

------------------------------------------------------------
Sending alerts...
  EMAIL: SUCCESS
============================================================
```

## Step 10: Set Up Continuous Monitoring

To run continuous monitoring in the background:

### Option 1: Run in Terminal (Testing)

```bash
python main.py monitor
```

This will run until you press Ctrl+C.

### Option 2: Run as a Background Service (Linux/Mac)

Create a systemd service file:

```bash
sudo nano /etc/systemd/system/care-gap-monitor.service
```

Add:
```ini
[Unit]
Description=EMR Care Gap Monitoring Service
After=network.target

[Service]
Type=simple
User=yourusername
WorkingDirectory=/path/to/new
ExecStart=/usr/bin/python3 /path/to/new/main.py monitor
Restart=always
RestartSec=60

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl enable care-gap-monitor
sudo systemctl start care-gap-monitor
sudo systemctl status care-gap-monitor
```

### Option 3: Use Cron (Linux/Mac)

Add to your crontab:
```bash
crontab -e
```

Add this line to run daily at 9 AM:
```
0 9 * * * cd /path/to/new && /usr/bin/python3 main.py check >> /path/to/new/cron.log 2>&1
```

### Option 4: Task Scheduler (Windows)

1. Open Task Scheduler
2. Create Basic Task
3. Set trigger (e.g., daily at 9 AM)
4. Set action: Start a program
   - Program: `python`
   - Arguments: `main.py check`
   - Start in: `C:\path\to\new`

## Step 11: Monitor and Maintain

### Check Status Regularly

```bash
python main.py status
```

### Review Logs

```bash
tail -f care_gap_monitor.log
```

### View Alert History

The SQLite database `care_gaps.db` stores all alert history.

To query it:
```bash
sqlite3 care_gaps.db "SELECT * FROM alert_history ORDER BY alert_sent_at DESC LIMIT 10;"
```

## Troubleshooting Common Issues

### Issue: "Failed to connect to Elation Health API"

**Solutions**:
1. Verify API credentials in `.env`
2. Check internet connection
3. Ensure base URL is correct
4. Try the test command: `python main.py test`

### Issue: "No module named 'src'"

**Solution**:
Make sure you're running from the project directory:
```bash
cd /path/to/new
python main.py check
```

### Issue: Email alerts not sending

**Solutions**:
1. Verify SMTP credentials
2. For Gmail, use an App Password, not your regular password
3. Check firewall isn't blocking SMTP port
4. Test with a simple SMTP test:
   ```python
   import smtplib
   server = smtplib.SMTP('smtp.gmail.com', 587)
   server.starttls()
   server.login('your_email@gmail.com', 'your_app_password')
   print("Success!")
   server.quit()
   ```

### Issue: No care gaps detected (but you expect some)

**Solutions**:
1. Verify rules apply to your patient profile
2. Check if patient has required conditions
3. Review rule conditions (age, gender requirements)
4. Enable debug logging to see rule evaluation

## Security Best Practices

1. **Protect your `.env` file**:
   ```bash
   chmod 600 .env
   ```

2. **Never commit credentials**:
   - The `.gitignore` already excludes `.env`
   - Double-check before committing

3. **Use strong passwords**:
   - For API keys
   - For email accounts
   - For database access

4. **Regular updates**:
   ```bash
   pip install --upgrade -r requirements.txt
   ```

5. **Backup your configuration**:
   ```bash
   cp care_gap_rules.yaml care_gap_rules.yaml.backup
   ```

## Next Steps

1. **Customize rules** for your specific health needs
2. **Test thoroughly** with manual checks before enabling continuous monitoring
3. **Review alerts** to ensure they're actionable
4. **Adjust frequencies** based on your preferences
5. **Set up automated monitoring** using one of the methods above

## Getting Help

If you encounter issues:

1. Check the logs: `care_gap_monitor.log`
2. Review this guide
3. Consult the main README.md
4. Check Elation Health API documentation
5. Open an issue in the repository

## Health Privacy Note

This application accesses your Protected Health Information (PHI). Ensure:
- Your computer is secure and encrypted
- You use strong passwords
- You understand who has access to the system
- You comply with applicable privacy regulations
- You regularly review access logs

---

**You're all set!** The EMR Care Gap Monitoring System is now ready to help you stay on top of your healthcare needs.
