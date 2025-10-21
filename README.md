# EMR Care Gap Monitoring System

An automated monitoring system for Elation Health EMR that detects care gaps and sends customizable alerts for lab work, follow-up appointments, preventive screenings, and other healthcare needs.

## Features

- **Customizable Care Gap Rules**: Define your own rules for monitoring different types of care gaps
- **Multiple Alert Channels**: Receive notifications via email and SMS
- **Intelligent Scheduling**: Respects quiet hours and configurable reminder frequencies
- **Comprehensive Tracking**: Monitor lab work, appointments, medications, immunizations, screenings, and vital signs
- **Priority-Based Alerts**: Categorize gaps by urgency (high, medium, low)
- **Automated Monitoring**: Run continuous checks or schedule periodic scans
- **Alert History**: Track when and how alerts were sent

## Supported Care Gap Types

1. **Lab Work**: Monitor overdue lab tests (cholesterol, HbA1c, CMP, TSH, etc.)
2. **Follow-up Appointments**: Track needed visits for chronic disease management and annual physicals
3. **Medication Management**: Alert when refills are needed or medication reviews are due
4. **Immunizations**: Monitor flu shots and other vaccinations
5. **Preventive Screenings**: Track mammography, colonoscopy, and other cancer screenings
6. **Vital Monitoring**: Ensure regular blood pressure, weight, and other vital sign checks

## Prerequisites

- Python 3.11 or higher
- Elation Health API credentials
- SMTP server access for email alerts (optional)
- Twilio account for SMS alerts (optional)

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd new
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your credentials:
   ```env
   # Elation Health API
   ELATION_API_KEY=your_api_key
   ELATION_API_SECRET=your_api_secret
   ELATION_BASE_URL=https://api.elationhealth.com
   ELATION_PATIENT_ID=your_patient_id

   # Email Alerts
   ALERT_EMAIL_FROM=alerts@example.com
   ALERT_EMAIL_TO=your_email@example.com
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USERNAME=your_smtp_username
   SMTP_PASSWORD=your_smtp_password

   # SMS Alerts (optional)
   TWILIO_ACCOUNT_SID=your_twilio_sid
   TWILIO_AUTH_TOKEN=your_twilio_token
   TWILIO_FROM_NUMBER=+1234567890
   TWILIO_TO_NUMBER=+1234567890
   ```

4. **Customize care gap rules** (optional):
   Edit `care_gap_rules.yaml` to add, remove, or modify monitoring rules

## Getting Elation Health API Credentials

1. Visit the [Elation Developer Sandbox](https://www.elationhealth.com/contact-us/sandbox/)
2. Register as a trusted developer
3. Request API credentials
4. Once approved, you'll receive your API key and secret
5. Find your patient ID in your Elation Health account

For detailed API documentation, visit:
- [Elation API 2.0 Documentation](https://docs.elationhealth.com/reference/introduction)
- [Elation FHIR API](https://elationfhir.readme.io/reference/getting-started-with-standardized-api)

## Usage

### Test API Connection

```bash
python main.py test
```

### Run a Single Check

Run a one-time care gap check and send alerts:

```bash
python main.py check
```

### Start Continuous Monitoring

Run continuous monitoring based on your configured schedule:

```bash
python main.py monitor
```

This will check for care gaps at the interval specified in `care_gap_rules.yaml` (default: every 24 hours at 9:00 AM).

### View Status

Check the monitoring status and recent alerts:

```bash
python main.py status
```

### List All Rules

Display all configured care gap rules:

```bash
python main.py rules
```

### Use Custom Rules File

Specify a different rules configuration file:

```bash
python main.py check --rules-file my_custom_rules.yaml
```

## Customizing Care Gap Rules

Edit `care_gap_rules.yaml` to customize monitoring rules. Each rule has the following structure:

```yaml
- id: unique_rule_id
  name: Human-readable rule name
  type: rule_type  # lab_work, follow_up_appointment, medication_management, etc.
  description: Description of what this rule monitors
  enabled: true
  conditions:
    max_days_since_last: 365  # How often this should occur
    applies_to_conditions:     # Only apply if patient has these conditions
      - "diabetes"
      - "hypertension"
    # Other type-specific conditions
  alert_priority: high  # high, medium, or low
  alert_message: Message to send in alert
```

### Rule Types

- `lab_work`: Monitor lab tests by LOINC code
- `follow_up_appointment`: Track appointment types
- `medication_management`: Monitor medication refills and reviews
- `immunization`: Track vaccinations by CVX code
- `preventive_screening`: Monitor screenings by CPT code
- `vital_monitoring`: Track vital sign measurements

### Example: Add a Custom Lab Test Rule

```yaml
- id: vitamin_d_screening
  name: Annual Vitamin D Test
  type: lab_work
  description: Annual vitamin D level check
  enabled: true
  conditions:
    lab_test_code: "1989-3"  # LOINC code for Vitamin D
    max_days_since_last: 365
  alert_priority: medium
  alert_message: "Your annual vitamin D test is due."
```

### Example: Add a Custom Appointment Rule

```yaml
- id: mental_health_check_in
  name: Mental Health Check-in
  type: follow_up_appointment
  description: Quarterly mental health appointment
  enabled: true
  conditions:
    appointment_type: "mental-health"
    max_days_since_last: 90
  alert_priority: high
  alert_message: "Time to schedule your mental health check-in appointment."
```

## Alert Configuration

Configure alert behavior in `care_gap_rules.yaml`:

```yaml
alert_settings:
  # Quiet hours (no alerts sent during this time)
  quiet_hours_start: "22:00"
  quiet_hours_end: "08:00"

  # How often to repeat alerts (in days)
  reminder_frequency_days:
    high: 3      # Repeat high-priority alerts every 3 days
    medium: 7    # Repeat medium-priority alerts every 7 days
    low: 14      # Repeat low-priority alerts every 14 days

  # Alert methods to use
  methods:
    - email
    - sms  # Uncomment if you have Twilio configured
```

## Monitoring Schedule

Configure when checks are performed:

```yaml
monitoring:
  check_interval: 24           # Hours between checks
  preferred_check_time: "09:00"  # Time of day to run checks (24-hour format)
```

## Understanding Standard Medical Codes

The system uses industry-standard medical coding systems:

- **LOINC Codes**: Lab test identifiers (e.g., "2093-3" for Total Cholesterol)
  - Find codes at [LOINC.org](https://loinc.org/)

- **CVX Codes**: Vaccine identifiers (e.g., "141" for Influenza vaccine)
  - Find codes at [CDC CVX Codes](https://www2a.cdc.gov/vaccines/iis/iisstandards/vaccines.asp)

- **CPT Codes**: Procedure codes (e.g., "77067" for Mammography)
  - Find codes at [AMA CPT](https://www.ama-assn.org/practice-management/cpt)

## Logs and History

- **Application logs**: `care_gap_monitor.log`
- **Alert history**: Stored in `care_gaps.db` (SQLite database)

View recent alert history:

```bash
python main.py status
```

## Email Alert Format

Alerts are sent as formatted HTML emails with:
- Summary of total care gaps
- Gaps grouped by priority (high, medium, low)
- Details for each gap including type, days overdue, and action needed
- Color-coded priority indicators

## SMS Alert Format

SMS alerts provide a concise summary:
- Total number of care gaps
- Number of high-priority gaps
- Prompt to check email for details

## Troubleshooting

### API Connection Issues

```bash
# Test your API connection
python main.py test

# Check logs for detailed error messages
tail -f care_gap_monitor.log
```

### Email Alerts Not Sending

1. Verify SMTP credentials in `.env`
2. For Gmail, enable "Less secure app access" or use an App Password
3. Check firewall settings for SMTP port (typically 587)
4. Review logs for detailed error messages

### SMS Alerts Not Sending

1. Verify Twilio credentials in `.env`
2. Ensure your Twilio account is active and funded
3. Verify phone numbers are in E.164 format (+1234567890)
4. Check Twilio console for error messages

### Rules Not Triggering

1. Verify the rule is enabled (`enabled: true`)
2. Check if the rule's conditions apply to your patient profile
3. Verify medical codes (LOINC, CVX, CPT) are correct
4. Review logs to see which rules are being evaluated

## Security Considerations

- **Never commit `.env`**: Your API credentials and secrets should never be in version control
- **Secure API credentials**: Store in environment variables or a secure vault
- **HTTPS only**: The application enforces HTTPS for API connections
- **PHI compliance**: This application handles Protected Health Information (PHI). Ensure your deployment complies with HIPAA and other relevant regulations
- **Access control**: Restrict access to the application and its data files

## Architecture

```
┌─────────────────────────────────────────────┐
│         Main Application (main.py)          │
└─────────────────┬───────────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
┌───────▼────────┐  ┌──────▼──────────┐
│ Elation Client │  │ Care Gap Engine │
│ (API wrapper)  │  │ (Rule evaluator)│
└────────────────┘  └──────┬──────────┘
                           │
                    ┌──────▼───────────┐
                    │  Alert Manager   │
                    │ (Email/SMS)      │
                    └──────────────────┘
```

## Development

### Project Structure

```
new/
├── main.py                   # Main application entry point
├── requirements.txt          # Python dependencies
├── care_gap_rules.yaml       # Care gap rules configuration
├── .env.example             # Environment variable template
├── .gitignore               # Git ignore rules
├── README.md                # This file
├── src/
│   ├── __init__.py
│   ├── elation_client.py    # Elation Health API client
│   ├── care_gap_engine.py   # Care gap detection engine
│   └── alert_manager.py     # Alert and notification manager
└── care_gaps.db             # SQLite database (created on first run)
```

### Running Tests

```bash
# Test API connection
python main.py test

# Run a dry-run check
python main.py check
```

### Extending the System

To add support for a new care gap type:

1. Add a new rule type to `care_gap_rules.yaml`
2. Implement a corresponding check method in `CareGapEngine` (e.g., `_check_new_type_gap()`)
3. Add the method to the type mapping in `check_all_gaps()`

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is provided as-is for personal health monitoring purposes. Always consult with healthcare professionals for medical decisions.

## Disclaimer

This application is a monitoring tool and does not provide medical advice. It is not a substitute for professional medical care. Always consult with qualified healthcare providers for health-related decisions.

The accuracy of care gap detection depends on:
- Completeness of EMR data
- Accuracy of configured rules
- Proper API credentials and access

## Support

For issues or questions:

1. Check the logs: `care_gap_monitor.log`
2. Review Elation Health API documentation
3. Verify your configuration in `.env` and `care_gap_rules.yaml`
4. Open an issue in the repository

## Roadmap

Future enhancements:

- [ ] Web dashboard for viewing care gaps
- [ ] Push notifications via mobile apps
- [ ] Integration with calendar apps for appointment scheduling
- [ ] Machine learning for personalized care gap predictions
- [ ] Support for multiple patients/family members
- [ ] Integration with wearable devices
- [ ] Medication interaction checking
- [ ] Health goal tracking

## Acknowledgments

- Built for Elation Health EMR platform
- Uses industry-standard medical coding (LOINC, CVX, CPT)
- Designed with HIPAA compliance in mind
