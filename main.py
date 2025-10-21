#!/usr/bin/env python3
"""
EMR Care Gap Monitoring System
Main application for monitoring Elation Health EMR and alerting on care gaps
"""

import os
import sys
import logging
import argparse
import time
import schedule
from datetime import datetime
from dotenv import load_dotenv

from src.elation_client import ElationHealthClient
from src.care_gap_engine import CareGapEngine
from src.alert_manager import AlertManager


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('care_gap_monitor.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


class CareGapMonitor:
    """Main care gap monitoring application"""

    def __init__(self, rules_file: str = 'care_gap_rules.yaml'):
        """
        Initialize care gap monitor

        Args:
            rules_file: Path to care gap rules configuration
        """
        # Load environment variables
        load_dotenv()

        # Initialize components
        logger.info("Initializing EMR Care Gap Monitor...")

        self.elation_client = ElationHealthClient()
        self.engine = CareGapEngine(self.elation_client, rules_file)
        self.alert_manager = AlertManager(self.engine.alert_settings)

        logger.info("Initialization complete")

    def test_connection(self) -> bool:
        """
        Test connection to Elation Health API

        Returns:
            True if connection successful
        """
        logger.info("Testing connection to Elation Health API...")
        return self.elation_client.test_connection()

    def check_gaps_once(self):
        """Run a single care gap check"""
        logger.info("=" * 60)
        logger.info("Starting care gap check...")
        logger.info("=" * 60)

        try:
            # Check for care gaps
            gaps = self.engine.check_all_gaps()

            if not gaps:
                logger.info("No care gaps detected!")
                return

            # Display detected gaps
            logger.info(f"\nDetected {len(gaps)} care gap(s):")
            logger.info("-" * 60)

            gaps_by_priority = {
                'high': [g for g in gaps if g.priority == 'high'],
                'medium': [g for g in gaps if g.priority == 'medium'],
                'low': [g for g in gaps if g.priority == 'low']
            }

            for priority in ['high', 'medium', 'low']:
                priority_gaps = gaps_by_priority[priority]
                if priority_gaps:
                    logger.info(f"\n{priority.upper()} PRIORITY ({len(priority_gaps)}):")
                    for gap in priority_gaps:
                        logger.info(f"  - {gap.rule_name}")
                        logger.info(f"    Type: {gap.gap_type}")
                        if gap.days_overdue > 0:
                            logger.info(f"    Days overdue: {gap.days_overdue}")
                        logger.info(f"    Message: {gap.message}")
                        logger.info("")

            # Send alerts
            logger.info("-" * 60)
            logger.info("Sending alerts...")
            results = self.alert_manager.send_alerts(gaps)

            for method, success in results.items():
                status = "SUCCESS" if success else "FAILED"
                logger.info(f"  {method.upper()}: {status}")

            logger.info("=" * 60)
            logger.info("Care gap check complete")
            logger.info("=" * 60)

        except Exception as e:
            logger.error(f"Error during care gap check: {str(e)}", exc_info=True)

    def run_continuous(self):
        """Run continuous monitoring based on schedule"""
        check_interval = self.engine.monitoring_config.get('check_interval', 24)
        preferred_time = self.engine.monitoring_config.get('preferred_check_time', '09:00')

        logger.info(f"Starting continuous monitoring...")
        logger.info(f"Check interval: Every {check_interval} hours")
        logger.info(f"Preferred check time: {preferred_time}")

        # Schedule the check
        schedule.every(check_interval).hours.at(preferred_time).do(self.check_gaps_once)

        # Run first check immediately
        self.check_gaps_once()

        # Run scheduled checks
        logger.info("Monitoring is running. Press Ctrl+C to stop.")
        try:
            while True:
                schedule.run_pending()
                time.sleep(60)  # Check every minute
        except KeyboardInterrupt:
            logger.info("\nMonitoring stopped by user")

    def show_status(self):
        """Display current monitoring status and recent alerts"""
        logger.info("=" * 60)
        logger.info("EMR CARE GAP MONITOR - STATUS")
        logger.info("=" * 60)

        # Show connection status
        logger.info("\nConnection Status:")
        if self.test_connection():
            logger.info("  Elation Health API: CONNECTED")
        else:
            logger.info("  Elation Health API: DISCONNECTED")

        # Show enabled rules
        logger.info(f"\nEnabled Care Gap Rules: {len(self.engine.rules)}")
        by_type = {}
        for rule in self.engine.rules:
            rule_type = rule.get('type', 'unknown')
            by_type[rule_type] = by_type.get(rule_type, 0) + 1

        for rule_type, count in sorted(by_type.items()):
            logger.info(f"  {rule_type.replace('_', ' ').title()}: {count}")

        # Show recent alerts
        logger.info("\nRecent Alerts (Last 7 days):")
        recent_alerts = self.alert_manager.get_alert_history(days=7)

        if not recent_alerts:
            logger.info("  No recent alerts")
        else:
            for alert in recent_alerts[:10]:  # Show last 10
                sent_at = datetime.fromisoformat(alert['alert_sent_at'])
                logger.info(
                    f"  {sent_at.strftime('%Y-%m-%d %H:%M')} - "
                    f"{alert['gap_type']} ({alert['priority']}) via {alert['alert_method']}"
                )

        logger.info("=" * 60)

    def list_rules(self):
        """List all configured care gap rules"""
        logger.info("=" * 60)
        logger.info("CONFIGURED CARE GAP RULES")
        logger.info("=" * 60)

        by_type = {}
        for rule in self.engine.rules:
            rule_type = rule.get('type', 'unknown')
            if rule_type not in by_type:
                by_type[rule_type] = []
            by_type[rule_type].append(rule)

        for rule_type in sorted(by_type.keys()):
            logger.info(f"\n{rule_type.replace('_', ' ').title().upper()}:")
            logger.info("-" * 60)

            for rule in by_type[rule_type]:
                logger.info(f"\n  {rule['name']} (ID: {rule['id']})")
                logger.info(f"  {rule['description']}")
                logger.info(f"  Priority: {rule.get('alert_priority', 'medium')}")

                conditions = rule.get('conditions', {})
                if 'max_days_since_last' in conditions:
                    logger.info(f"  Frequency: Every {conditions['max_days_since_last']} days")

        logger.info("\n" + "=" * 60)


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='EMR Care Gap Monitoring System for Elation Health',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s check              Run a single care gap check
  %(prog)s monitor            Start continuous monitoring
  %(prog)s status             Show monitoring status
  %(prog)s rules              List all configured rules
  %(prog)s test               Test API connection
        """
    )

    parser.add_argument(
        'command',
        choices=['check', 'monitor', 'status', 'rules', 'test'],
        help='Command to execute'
    )

    parser.add_argument(
        '--rules-file',
        default='care_gap_rules.yaml',
        help='Path to care gap rules configuration file (default: care_gap_rules.yaml)'
    )

    args = parser.parse_args()

    # Create monitor instance
    monitor = CareGapMonitor(args.rules_file)

    # Execute command
    try:
        if args.command == 'check':
            monitor.check_gaps_once()

        elif args.command == 'monitor':
            monitor.run_continuous()

        elif args.command == 'status':
            monitor.show_status()

        elif args.command == 'rules':
            monitor.list_rules()

        elif args.command == 'test':
            if monitor.test_connection():
                logger.info("API connection test: SUCCESS")
                sys.exit(0)
            else:
                logger.error("API connection test: FAILED")
                sys.exit(1)

    except KeyboardInterrupt:
        logger.info("\nOperation cancelled by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Error: {str(e)}", exc_info=True)
        sys.exit(1)


if __name__ == '__main__':
    main()
