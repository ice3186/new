"""
Care Gap Rules Engine
Evaluates patient data against configured care gap rules
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import yaml

from src.elation_client import ElationHealthClient


logger = logging.getLogger(__name__)


class CareGap:
    """Represents a detected care gap"""

    def __init__(
        self,
        rule_id: str,
        rule_name: str,
        gap_type: str,
        description: str,
        priority: str,
        message: str,
        days_overdue: int = 0,
        last_completed: Optional[datetime] = None
    ):
        self.rule_id = rule_id
        self.rule_name = rule_name
        self.gap_type = gap_type
        self.description = description
        self.priority = priority
        self.message = message
        self.days_overdue = days_overdue
        self.last_completed = last_completed
        self.detected_at = datetime.now()

    def to_dict(self) -> Dict[str, Any]:
        """Convert care gap to dictionary"""
        return {
            'rule_id': self.rule_id,
            'rule_name': self.rule_name,
            'gap_type': self.gap_type,
            'description': self.description,
            'priority': self.priority,
            'message': self.message,
            'days_overdue': self.days_overdue,
            'last_completed': self.last_completed.isoformat() if self.last_completed else None,
            'detected_at': self.detected_at.isoformat()
        }

    def __repr__(self) -> str:
        return f"CareGap({self.rule_name}, priority={self.priority}, days_overdue={self.days_overdue})"


class CareGapEngine:
    """Engine for detecting care gaps based on rules"""

    def __init__(
        self,
        elation_client: ElationHealthClient,
        rules_file: str = 'care_gap_rules.yaml'
    ):
        """
        Initialize care gap engine

        Args:
            elation_client: Elation Health API client
            rules_file: Path to rules configuration file
        """
        self.client = elation_client
        self.rules_file = rules_file
        self.rules = []
        self.alert_settings = {}
        self.monitoring_config = {}
        self.patient_conditions = []
        self.patient_demographics = {}

        self._load_rules()

    def _load_rules(self):
        """Load care gap rules from YAML configuration"""
        try:
            with open(self.rules_file, 'r') as f:
                config = yaml.safe_load(f)

            self.rules = config.get('rules', [])
            self.alert_settings = config.get('alert_settings', {})
            self.monitoring_config = config.get('monitoring', {})

            # Filter enabled rules only
            self.rules = [rule for rule in self.rules if rule.get('enabled', True)]

            logger.info(f"Loaded {len(self.rules)} care gap rules")

        except Exception as e:
            logger.error(f"Failed to load rules from {self.rules_file}: {str(e)}")
            raise

    def _load_patient_context(self):
        """Load patient demographics and active conditions"""
        try:
            self.patient_demographics = self.client.get_patient_demographics()
            self.patient_conditions = self.client.get_patient_conditions()

            logger.info(f"Loaded patient context: {len(self.patient_conditions)} active conditions")

        except Exception as e:
            logger.error(f"Failed to load patient context: {str(e)}")
            raise

    def _rule_applies_to_patient(self, rule: Dict[str, Any]) -> bool:
        """
        Check if a rule applies to the patient based on conditions

        Args:
            rule: Care gap rule

        Returns:
            True if rule applies to patient
        """
        conditions = rule.get('conditions', {})

        # Check age requirements
        if 'min_age' in conditions:
            patient_age = self._calculate_patient_age()
            if patient_age < conditions['min_age']:
                return False

        if 'max_age' in conditions:
            patient_age = self._calculate_patient_age()
            if patient_age > conditions['max_age']:
                return False

        # Check gender requirements
        if 'gender' in conditions:
            patient_gender = self.patient_demographics.get('gender', '').lower()
            if patient_gender != conditions['gender'].lower():
                return False

        # Check if patient has required conditions
        if 'applies_to_conditions' in conditions:
            required_conditions = [c.lower() for c in conditions['applies_to_conditions']]
            patient_condition_names = [
                c.get('name', '').lower() for c in self.patient_conditions
            ]

            # Check if any required condition matches
            has_required_condition = any(
                any(req_cond in pc for req_cond in required_conditions)
                for pc in patient_condition_names
            )

            if not has_required_condition:
                return False

        return True

    def _calculate_patient_age(self) -> int:
        """Calculate patient's age from demographics"""
        dob_str = self.patient_demographics.get('date_of_birth')
        if not dob_str:
            return 0

        try:
            dob = datetime.strptime(dob_str, '%Y-%m-%d')
            today = datetime.now()
            age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
            return age
        except Exception:
            return 0

    def _check_lab_work_gap(self, rule: Dict[str, Any]) -> Optional[CareGap]:
        """Check for lab work care gaps"""
        conditions = rule.get('conditions', {})
        lab_test_code = conditions.get('lab_test_code')
        max_days = conditions.get('max_days_since_last', 365)

        # Get lab results
        cutoff_date = datetime.now() - timedelta(days=max_days)
        lab_results = self.client.get_lab_results(
            since_date=cutoff_date,
            lab_test_code=lab_test_code
        )

        if not lab_results:
            # No recent lab results found - care gap exists
            # Try to find last result
            all_results = self.client.get_lab_results(lab_test_code=lab_test_code)
            last_result = None
            days_overdue = max_days

            if all_results:
                last_result = max(all_results, key=lambda x: x.get('date', ''))
                last_date = datetime.strptime(last_result.get('date'), '%Y-%m-%d')
                days_since = (datetime.now() - last_date).days
                days_overdue = days_since - max_days

            return CareGap(
                rule_id=rule['id'],
                rule_name=rule['name'],
                gap_type=rule['type'],
                description=rule['description'],
                priority=rule.get('alert_priority', 'medium'),
                message=rule.get('alert_message', ''),
                days_overdue=max(days_overdue, 0),
                last_completed=last_result.get('date') if last_result else None
            )

        return None

    def _check_appointment_gap(self, rule: Dict[str, Any]) -> Optional[CareGap]:
        """Check for follow-up appointment care gaps"""
        conditions = rule.get('conditions', {})
        appointment_type = conditions.get('appointment_type')
        max_days = conditions.get('max_days_since_last', 90)

        # Get appointments
        cutoff_date = datetime.now() - timedelta(days=max_days)
        appointments = self.client.get_appointments(
            since_date=cutoff_date,
            appointment_type=appointment_type
        )

        if not appointments:
            # No recent appointments - care gap exists
            all_appointments = self.client.get_appointments(
                appointment_type=appointment_type
            )
            last_appointment = None
            days_overdue = max_days

            if all_appointments:
                last_appointment = max(all_appointments, key=lambda x: x.get('date', ''))
                last_date = datetime.strptime(last_appointment.get('date'), '%Y-%m-%d')
                days_since = (datetime.now() - last_date).days
                days_overdue = days_since - max_days

            return CareGap(
                rule_id=rule['id'],
                rule_name=rule['name'],
                gap_type=rule['type'],
                description=rule['description'],
                priority=rule.get('alert_priority', 'medium'),
                message=rule.get('alert_message', ''),
                days_overdue=max(days_overdue, 0),
                last_completed=last_appointment.get('date') if last_appointment else None
            )

        return None

    def _check_medication_gap(self, rule: Dict[str, Any]) -> Optional[CareGap]:
        """Check for medication management care gaps"""
        conditions = rule.get('conditions', {})
        medications = self.client.get_medications()

        # Check for low medication supply
        if 'days_supply_remaining' in conditions:
            min_days = conditions['days_supply_remaining']

            for med in medications:
                days_remaining = med.get('days_supply_remaining', 0)
                if days_remaining <= min_days:
                    return CareGap(
                        rule_id=rule['id'],
                        rule_name=rule['name'],
                        gap_type=rule['type'],
                        description=f"{rule['description']} - {med.get('name', 'Unknown')}",
                        priority=rule.get('alert_priority', 'medium'),
                        message=rule.get('alert_message', ''),
                        days_overdue=min_days - days_remaining
                    )

        # Check for medication review
        if 'max_days_since_last_review' in conditions:
            max_days = conditions['max_days_since_last_review']
            # This would require medication review dates from the API
            # For now, return None
            pass

        return None

    def _check_immunization_gap(self, rule: Dict[str, Any]) -> Optional[CareGap]:
        """Check for immunization care gaps"""
        conditions = rule.get('conditions', {})
        vaccine_code = conditions.get('vaccine_code')
        max_days = conditions.get('max_days_since_last', 365)

        # Get immunizations
        cutoff_date = datetime.now() - timedelta(days=max_days)
        immunizations = self.client.get_immunizations(
            since_date=cutoff_date,
            vaccine_code=vaccine_code
        )

        if not immunizations:
            # Check seasonal reminder
            seasonal_date = conditions.get('seasonal_reminder')
            if seasonal_date:
                # Check if we're past the seasonal date
                month, day = map(int, seasonal_date.split('-'))
                today = datetime.now()
                seasonal = datetime(today.year, month, day)

                if today < seasonal:
                    return None  # Not yet time for seasonal vaccine

            return CareGap(
                rule_id=rule['id'],
                rule_name=rule['name'],
                gap_type=rule['type'],
                description=rule['description'],
                priority=rule.get('alert_priority', 'medium'),
                message=rule.get('alert_message', ''),
                days_overdue=0
            )

        return None

    def _check_screening_gap(self, rule: Dict[str, Any]) -> Optional[CareGap]:
        """Check for preventive screening care gaps"""
        conditions = rule.get('conditions', {})
        screening_code = conditions.get('screening_code')
        max_days = conditions.get('max_days_since_last', 365)

        # Get screenings
        cutoff_date = datetime.now() - timedelta(days=max_days)
        screenings = self.client.get_preventive_screenings(
            since_date=cutoff_date,
            screening_code=screening_code
        )

        if not screenings:
            return CareGap(
                rule_id=rule['id'],
                rule_name=rule['name'],
                gap_type=rule['type'],
                description=rule['description'],
                priority=rule.get('alert_priority', 'medium'),
                message=rule.get('alert_message', ''),
                days_overdue=0
            )

        return None

    def _check_vital_monitoring_gap(self, rule: Dict[str, Any]) -> Optional[CareGap]:
        """Check for vital monitoring care gaps"""
        conditions = rule.get('conditions', {})
        vital_type = conditions.get('vital_type')
        max_days = conditions.get('max_days_since_last', 30)

        # Get vitals
        cutoff_date = datetime.now() - timedelta(days=max_days)
        vitals = self.client.get_vitals(
            since_date=cutoff_date,
            vital_type=vital_type
        )

        if not vitals:
            return CareGap(
                rule_id=rule['id'],
                rule_name=rule['name'],
                gap_type=rule['type'],
                description=rule['description'],
                priority=rule.get('alert_priority', 'medium'),
                message=rule.get('alert_message', ''),
                days_overdue=0
            )

        return None

    def check_all_gaps(self) -> List[CareGap]:
        """
        Check all care gap rules and return detected gaps

        Returns:
            List of detected care gaps
        """
        logger.info("Starting care gap analysis...")

        # Load patient context
        self._load_patient_context()

        detected_gaps = []

        for rule in self.rules:
            try:
                # Check if rule applies to this patient
                if not self._rule_applies_to_patient(rule):
                    continue

                # Check gap based on rule type
                gap = None
                rule_type = rule.get('type')

                if rule_type == 'lab_work':
                    gap = self._check_lab_work_gap(rule)
                elif rule_type == 'follow_up_appointment':
                    gap = self._check_appointment_gap(rule)
                elif rule_type == 'medication_management':
                    gap = self._check_medication_gap(rule)
                elif rule_type == 'immunization':
                    gap = self._check_immunization_gap(rule)
                elif rule_type == 'preventive_screening':
                    gap = self._check_screening_gap(rule)
                elif rule_type == 'vital_monitoring':
                    gap = self._check_vital_monitoring_gap(rule)

                if gap:
                    detected_gaps.append(gap)
                    logger.info(f"Detected care gap: {gap}")

            except Exception as e:
                logger.error(f"Error checking rule {rule.get('id')}: {str(e)}")
                continue

        logger.info(f"Care gap analysis complete. Found {len(detected_gaps)} gaps.")
        return detected_gaps

    def get_gaps_by_priority(self) -> Dict[str, List[CareGap]]:
        """
        Get care gaps grouped by priority

        Returns:
            Dictionary with priorities as keys and lists of care gaps as values
        """
        gaps = self.check_all_gaps()

        by_priority = {
            'high': [],
            'medium': [],
            'low': []
        }

        for gap in gaps:
            by_priority[gap.priority].append(gap)

        return by_priority
