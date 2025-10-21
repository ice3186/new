"""
Elation Health API Client
Handles authentication and data retrieval from Elation Health EMR
"""

import os
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import requests
from requests.auth import HTTPBasicAuth


logger = logging.getLogger(__name__)


class ElationHealthClient:
    """Client for interacting with Elation Health API"""

    def __init__(
        self,
        api_key: Optional[str] = None,
        api_secret: Optional[str] = None,
        base_url: Optional[str] = None,
        patient_id: Optional[str] = None
    ):
        """
        Initialize Elation Health API client

        Args:
            api_key: API key for authentication
            api_secret: API secret for authentication
            base_url: Base URL for Elation Health API
            patient_id: Patient ID to monitor
        """
        self.api_key = api_key or os.getenv('ELATION_API_KEY')
        self.api_secret = api_secret or os.getenv('ELATION_API_SECRET')
        self.base_url = base_url or os.getenv('ELATION_BASE_URL', 'https://api.elationhealth.com')
        self.patient_id = patient_id or os.getenv('ELATION_PATIENT_ID')

        self.session = requests.Session()
        self.session.auth = HTTPBasicAuth(self.api_key, self.api_secret)
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })

    def _make_request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict] = None,
        data: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Make HTTP request to Elation Health API

        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint
            params: Query parameters
            data: Request body data

        Returns:
            Response data as dictionary

        Raises:
            requests.exceptions.RequestException: If request fails
        """
        url = f"{self.base_url}/{endpoint.lstrip('/')}"

        try:
            response = self.session.request(
                method=method,
                url=url,
                params=params,
                json=data,
                timeout=30
            )
            response.raise_for_status()
            return response.json() if response.content else {}

        except requests.exceptions.RequestException as e:
            logger.error(f"API request failed: {method} {url} - {str(e)}")
            raise

    def get_patient_demographics(self) -> Dict[str, Any]:
        """
        Get patient demographic information

        Returns:
            Patient demographics data
        """
        endpoint = f"patients/{self.patient_id}"
        return self._make_request('GET', endpoint)

    def get_patient_conditions(self) -> List[Dict[str, Any]]:
        """
        Get patient's active conditions/problems

        Returns:
            List of active conditions
        """
        endpoint = f"patients/{self.patient_id}/problems"
        response = self._make_request('GET', endpoint)
        return response.get('results', [])

    def get_lab_results(
        self,
        since_date: Optional[datetime] = None,
        lab_test_code: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get patient's lab results

        Args:
            since_date: Only return results after this date
            lab_test_code: Filter by specific LOINC code

        Returns:
            List of lab results
        """
        endpoint = f"patients/{self.patient_id}/lab_results"
        params = {}

        if since_date:
            params['created_date_min'] = since_date.strftime('%Y-%m-%d')

        if lab_test_code:
            params['loinc_code'] = lab_test_code

        response = self._make_request('GET', endpoint, params=params)
        return response.get('results', [])

    def get_appointments(
        self,
        since_date: Optional[datetime] = None,
        appointment_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get patient's appointments

        Args:
            since_date: Only return appointments after this date
            appointment_type: Filter by appointment type

        Returns:
            List of appointments
        """
        endpoint = f"patients/{self.patient_id}/appointments"
        params = {}

        if since_date:
            params['date_min'] = since_date.strftime('%Y-%m-%d')

        if appointment_type:
            params['service_type'] = appointment_type

        response = self._make_request('GET', endpoint, params=params)
        return response.get('results', [])

    def get_medications(self) -> List[Dict[str, Any]]:
        """
        Get patient's current medications

        Returns:
            List of medications
        """
        endpoint = f"patients/{self.patient_id}/medications"
        response = self._make_request('GET', endpoint)
        return response.get('results', [])

    def get_immunizations(
        self,
        since_date: Optional[datetime] = None,
        vaccine_code: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get patient's immunization records

        Args:
            since_date: Only return immunizations after this date
            vaccine_code: Filter by specific CVX vaccine code

        Returns:
            List of immunizations
        """
        endpoint = f"patients/{self.patient_id}/immunizations"
        params = {}

        if since_date:
            params['date_min'] = since_date.strftime('%Y-%m-%d')

        if vaccine_code:
            params['cvx_code'] = vaccine_code

        response = self._make_request('GET', endpoint, params=params)
        return response.get('results', [])

    def get_vitals(
        self,
        since_date: Optional[datetime] = None,
        vital_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get patient's vital signs

        Args:
            since_date: Only return vitals after this date
            vital_type: Filter by vital type (blood_pressure, weight, etc.)

        Returns:
            List of vital signs
        """
        endpoint = f"patients/{self.patient_id}/vitals"
        params = {}

        if since_date:
            params['date_min'] = since_date.strftime('%Y-%m-%d')

        if vital_type:
            params['type'] = vital_type

        response = self._make_request('GET', endpoint, params=params)
        return response.get('results', [])

    def get_preventive_screenings(
        self,
        since_date: Optional[datetime] = None,
        screening_code: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get patient's preventive screenings

        Args:
            since_date: Only return screenings after this date
            screening_code: Filter by specific CPT code

        Returns:
            List of preventive screenings
        """
        endpoint = f"patients/{self.patient_id}/procedures"
        params = {}

        if since_date:
            params['date_min'] = since_date.strftime('%Y-%m-%d')

        if screening_code:
            params['cpt_code'] = screening_code

        response = self._make_request('GET', endpoint, params=params)
        return response.get('results', [])

    def get_referrals(
        self,
        since_date: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """
        Get patient's specialist referrals

        Args:
            since_date: Only return referrals after this date

        Returns:
            List of referrals
        """
        endpoint = f"patients/{self.patient_id}/referrals"
        params = {}

        if since_date:
            params['created_date_min'] = since_date.strftime('%Y-%m-%d')

        response = self._make_request('GET', endpoint, params=params)
        return response.get('results', [])

    def test_connection(self) -> bool:
        """
        Test the API connection and authentication

        Returns:
            True if connection is successful, False otherwise
        """
        try:
            self.get_patient_demographics()
            logger.info("Successfully connected to Elation Health API")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to Elation Health API: {str(e)}")
            return False
