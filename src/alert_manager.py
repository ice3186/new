"""
Alert Manager
Handles sending alerts for detected care gaps via multiple channels
"""

import os
import logging
import smtplib
from datetime import datetime, time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Dict, Optional
import sqlite3
import json

from src.care_gap_engine import CareGap


logger = logging.getLogger(__name__)


class AlertManager:
    """Manages alerts for care gaps"""

    def __init__(
        self,
        alert_settings: Dict,
        db_path: str = 'care_gaps.db'
    ):
        """
        Initialize alert manager

        Args:
            alert_settings: Alert configuration from rules file
            db_path: Path to SQLite database for tracking alerts
        """
        self.alert_settings = alert_settings
        self.db_path = db_path
        self._init_database()

    def _init_database(self):
        """Initialize SQLite database for alert tracking"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS alert_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rule_id TEXT NOT NULL,
                gap_type TEXT NOT NULL,
                priority TEXT NOT NULL,
                alert_sent_at TIMESTAMP NOT NULL,
                alert_method TEXT NOT NULL,
                message TEXT,
                days_overdue INTEGER
            )
        ''')

        conn.commit()
        conn.close()

    def _should_send_alert(self, gap: CareGap) -> bool:
        """
        Determine if an alert should be sent based on quiet hours and reminder frequency

        Args:
            gap: Care gap to check

        Returns:
            True if alert should be sent
        """
        # Check quiet hours
        quiet_start = self.alert_settings.get('quiet_hours_start', '22:00')
        quiet_end = self.alert_settings.get('quiet_hours_end', '08:00')

        current_time = datetime.now().time()
        quiet_start_time = time.fromisoformat(quiet_start)
        quiet_end_time = time.fromisoformat(quiet_end)

        # Handle quiet hours that span midnight
        if quiet_start_time > quiet_end_time:
            if current_time >= quiet_start_time or current_time <= quiet_end_time:
                logger.info(f"Skipping alert for {gap.rule_name} - quiet hours")
                return False
        else:
            if quiet_start_time <= current_time <= quiet_end_time:
                logger.info(f"Skipping alert for {gap.rule_name} - quiet hours")
                return False

        # Check reminder frequency
        last_alert = self._get_last_alert(gap.rule_id)
        if last_alert:
            last_sent = datetime.fromisoformat(last_alert['alert_sent_at'])
            reminder_freq = self.alert_settings.get('reminder_frequency_days', {})
            days_between = reminder_freq.get(gap.priority, 7)

            days_since_last = (datetime.now() - last_sent).days
            if days_since_last < days_between:
                logger.info(
                    f"Skipping alert for {gap.rule_name} - "
                    f"last sent {days_since_last} days ago"
                )
                return False

        return True

    def _get_last_alert(self, rule_id: str) -> Optional[Dict]:
        """Get the most recent alert for a rule"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            SELECT rule_id, gap_type, priority, alert_sent_at, alert_method, message, days_overdue
            FROM alert_history
            WHERE rule_id = ?
            ORDER BY alert_sent_at DESC
            LIMIT 1
        ''', (rule_id,))

        row = cursor.fetchone()
        conn.close()

        if row:
            return {
                'rule_id': row[0],
                'gap_type': row[1],
                'priority': row[2],
                'alert_sent_at': row[3],
                'alert_method': row[4],
                'message': row[5],
                'days_overdue': row[6]
            }

        return None

    def _record_alert(self, gap: CareGap, method: str):
        """Record that an alert was sent"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            INSERT INTO alert_history (
                rule_id, gap_type, priority, alert_sent_at, alert_method, message, days_overdue
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            gap.rule_id,
            gap.gap_type,
            gap.priority,
            datetime.now().isoformat(),
            method,
            gap.message,
            gap.days_overdue
        ))

        conn.commit()
        conn.close()

    def _send_email_alert(self, gaps: List[CareGap]) -> bool:
        """
        Send email alert for care gaps

        Args:
            gaps: List of care gaps to alert about

        Returns:
            True if email sent successfully
        """
        try:
            smtp_host = os.getenv('SMTP_HOST')
            smtp_port = int(os.getenv('SMTP_PORT', '587'))
            smtp_username = os.getenv('SMTP_USERNAME')
            smtp_password = os.getenv('SMTP_PASSWORD')
            email_from = os.getenv('ALERT_EMAIL_FROM')
            email_to = os.getenv('ALERT_EMAIL_TO')

            if not all([smtp_host, smtp_username, smtp_password, email_from, email_to]):
                logger.warning("Email configuration incomplete - skipping email alert")
                return False

            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = f"Care Gap Alert: {len(gaps)} Item(s) Need Attention"
            msg['From'] = email_from
            msg['To'] = email_to

            # Create HTML content
            html_content = self._create_email_html(gaps)
            html_part = MIMEText(html_content, 'html')
            msg.attach(html_part)

            # Send email
            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                server.login(smtp_username, smtp_password)
                server.send_message(msg)

            logger.info(f"Email alert sent successfully to {email_to}")
            return True

        except Exception as e:
            logger.error(f"Failed to send email alert: {str(e)}")
            return False

    def _create_email_html(self, gaps: List[CareGap]) -> str:
        """Create HTML email content for care gaps"""
        priority_colors = {
            'high': '#dc3545',
            'medium': '#ffc107',
            'low': '#17a2b8'
        }

        gaps_by_priority = {
            'high': [g for g in gaps if g.priority == 'high'],
            'medium': [g for g in gaps if g.priority == 'medium'],
            'low': [g for g in gaps if g.priority == 'low']
        }

        html = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #007bff; color: white; padding: 20px; text-align: center; }}
                .gap-section {{ margin: 20px 0; }}
                .gap-card {{
                    border-left: 4px solid #ccc;
                    padding: 15px;
                    margin: 10px 0;
                    background-color: #f8f9fa;
                }}
                .priority-high {{ border-left-color: {priority_colors['high']}; }}
                .priority-medium {{ border-left-color: {priority_colors['medium']}; }}
                .priority-low {{ border-left-color: {priority_colors['low']}; }}
                .priority-badge {{
                    display: inline-block;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: bold;
                    color: white;
                }}
                .footer {{ margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; font-size: 12px; color: #666; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Care Gap Alert</h1>
                    <p>You have {len(gaps)} health care item(s) that need attention</p>
                </div>
        """

        for priority in ['high', 'medium', 'low']:
            priority_gaps = gaps_by_priority[priority]
            if not priority_gaps:
                continue

            html += f"""
                <div class="gap-section">
                    <h2>{priority.upper()} Priority ({len(priority_gaps)})</h2>
            """

            for gap in priority_gaps:
                overdue_text = f" ({gap.days_overdue} days overdue)" if gap.days_overdue > 0 else ""
                html += f"""
                    <div class="gap-card priority-{priority}">
                        <h3>{gap.rule_name}</h3>
                        <p><strong>Type:</strong> {gap.gap_type.replace('_', ' ').title()}</p>
                        <p><strong>Priority:</strong>
                            <span class="priority-badge" style="background-color: {priority_colors[priority]}">
                                {priority.upper()}
                            </span>
                        </p>
                        <p><strong>Message:</strong> {gap.message}{overdue_text}</p>
                        <p><small>{gap.description}</small></p>
                    </div>
                """

            html += "</div>"

        html += """
                <div class="footer">
                    <p>This is an automated alert from your EMR Care Gap Monitoring System</p>
                    <p>Please contact your healthcare provider to address these items</p>
                </div>
            </div>
        </body>
        </html>
        """

        return html

    def _send_sms_alert(self, gaps: List[CareGap]) -> bool:
        """
        Send SMS alert for care gaps

        Args:
            gaps: List of care gaps to alert about

        Returns:
            True if SMS sent successfully
        """
        try:
            # Check for Twilio configuration
            account_sid = os.getenv('TWILIO_ACCOUNT_SID')
            auth_token = os.getenv('TWILIO_AUTH_TOKEN')
            from_number = os.getenv('TWILIO_FROM_NUMBER')
            to_number = os.getenv('TWILIO_TO_NUMBER')

            if not all([account_sid, auth_token, from_number, to_number]):
                logger.warning("Twilio configuration incomplete - skipping SMS alert")
                return False

            # Import Twilio only if configured
            from twilio.rest import Client

            client = Client(account_sid, auth_token)

            # Create concise message (SMS has character limits)
            high_priority = [g for g in gaps if g.priority == 'high']
            message_text = f"Health Alert: {len(gaps)} care gap(s) detected."

            if high_priority:
                message_text += f" {len(high_priority)} HIGH priority. "
                message_text += f"Check your email for details or contact your provider."
            else:
                message_text += " Check your email for details."

            # Send SMS
            message = client.messages.create(
                body=message_text,
                from_=from_number,
                to=to_number
            )

            logger.info(f"SMS alert sent successfully: {message.sid}")
            return True

        except ImportError:
            logger.warning("Twilio library not available - skipping SMS alert")
            return False
        except Exception as e:
            logger.error(f"Failed to send SMS alert: {str(e)}")
            return False

    def send_alerts(self, gaps: List[CareGap]) -> Dict[str, bool]:
        """
        Send alerts for detected care gaps

        Args:
            gaps: List of care gaps to alert about

        Returns:
            Dictionary with alert methods and success status
        """
        if not gaps:
            logger.info("No care gaps to alert about")
            return {}

        # Filter gaps that should receive alerts
        gaps_to_alert = [gap for gap in gaps if self._should_send_alert(gap)]

        if not gaps_to_alert:
            logger.info("No care gaps meet alert criteria")
            return {}

        results = {}
        alert_methods = self.alert_settings.get('methods', ['email'])

        # Send alerts via configured methods
        if 'email' in alert_methods:
            results['email'] = self._send_email_alert(gaps_to_alert)
            if results['email']:
                for gap in gaps_to_alert:
                    self._record_alert(gap, 'email')

        if 'sms' in alert_methods:
            results['sms'] = self._send_sms_alert(gaps_to_alert)
            if results['sms']:
                for gap in gaps_to_alert:
                    self._record_alert(gap, 'sms')

        return results

    def get_alert_history(self, days: int = 30) -> List[Dict]:
        """
        Get alert history for the last N days

        Args:
            days: Number of days to look back

        Returns:
            List of alert records
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cutoff_date = datetime.now() - datetime.timedelta(days=days)

        cursor.execute('''
            SELECT rule_id, gap_type, priority, alert_sent_at, alert_method, message, days_overdue
            FROM alert_history
            WHERE alert_sent_at >= ?
            ORDER BY alert_sent_at DESC
        ''', (cutoff_date.isoformat(),))

        rows = cursor.fetchall()
        conn.close()

        return [
            {
                'rule_id': row[0],
                'gap_type': row[1],
                'priority': row[2],
                'alert_sent_at': row[3],
                'alert_method': row[4],
                'message': row[5],
                'days_overdue': row[6]
            }
            for row in rows
        ]
