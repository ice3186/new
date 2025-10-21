# Custom Care Gap Rules - Examples

This document provides examples of custom care gap rules you can add to `care_gap_rules.yaml`.

## Table of Contents

1. [Lab Work Examples](#lab-work-examples)
2. [Appointment Examples](#appointment-examples)
3. [Medication Examples](#medication-examples)
4. [Preventive Care Examples](#preventive-care-examples)
5. [Condition-Specific Examples](#condition-specific-examples)
6. [Finding Medical Codes](#finding-medical-codes)

## Lab Work Examples

### Vitamin D Screening

```yaml
- id: vitamin_d_screening
  name: Annual Vitamin D Test
  type: lab_work
  description: Annual vitamin D level check for bone health
  enabled: true
  conditions:
    lab_test_code: "1989-3"  # LOINC code for Vitamin D, 25-hydroxy
    max_days_since_last: 365
  alert_priority: low
  alert_message: "Your annual vitamin D test is due. Low vitamin D can affect bone health."
```

### PSA Test (Prostate Cancer Screening)

```yaml
- id: psa_screening
  name: PSA Screening
  type: lab_work
  description: Annual PSA test for prostate cancer screening
  enabled: true
  conditions:
    lab_test_code: "2857-1"  # LOINC code for PSA
    max_days_since_last: 365
    min_age: 50
    gender: "male"
  alert_priority: high
  alert_message: "Your annual PSA screening is due. This is important for prostate health."
```

### Liver Function Test

```yaml
- id: liver_function_test
  name: Liver Function Panel
  type: lab_work
  description: Monitor liver function for patients on certain medications
  enabled: true
  conditions:
    lab_test_code: "24325-3"  # LOINC code for Hepatic function panel
    max_days_since_last: 180  # Every 6 months
    applies_to_conditions:
      - "liver disease"
      - "hepatitis"
  alert_priority: high
  alert_message: "Your liver function test is due. This is important for monitoring your condition."
```

### Hemoglobin A1c (Diabetes - More Frequent)

```yaml
- id: diabetes_hba1c_tight_control
  name: Diabetes HbA1c - Tight Control
  type: lab_work
  description: Monthly HbA1c for tight diabetes control
  enabled: true
  conditions:
    lab_test_code: "4548-4"  # LOINC code for HbA1c
    max_days_since_last: 30   # Monthly instead of quarterly
    applies_to_conditions:
      - "uncontrolled diabetes"
      - "type 1 diabetes"
  alert_priority: high
  alert_message: "Your monthly HbA1c test is due for tight diabetes control."
```

## Appointment Examples

### Dermatology Skin Check

```yaml
- id: annual_skin_check
  name: Annual Dermatology Skin Exam
  type: follow_up_appointment
  description: Annual full-body skin examination
  enabled: true
  conditions:
    appointment_type: "dermatology"
    max_days_since_last: 365
  alert_priority: medium
  alert_message: "Schedule your annual skin cancer screening with dermatology."
```

### Eye Exam for Diabetes

```yaml
- id: diabetic_eye_exam
  name: Diabetic Retinopathy Screening
  type: follow_up_appointment
  description: Annual eye exam for diabetic patients
  enabled: true
  conditions:
    appointment_type: "ophthalmology"
    max_days_since_last: 365
    applies_to_conditions:
      - "diabetes mellitus"
      - "type 2 diabetes"
  alert_priority: high
  alert_message: "Your annual diabetic eye exam is due. Protect your vision."
```

### Cardiology Follow-up

```yaml
- id: cardiology_follow_up
  name: Cardiology Follow-up
  type: follow_up_appointment
  description: Regular cardiology follow-up for heart conditions
  enabled: true
  conditions:
    appointment_type: "cardiology"
    max_days_since_last: 180  # Every 6 months
    applies_to_conditions:
      - "heart failure"
      - "coronary artery disease"
      - "atrial fibrillation"
  alert_priority: high
  alert_message: "Your cardiology follow-up is due. Important for heart health monitoring."
```

### Dental Cleaning

```yaml
- id: dental_cleaning
  name: Dental Cleaning
  type: follow_up_appointment
  description: Bi-annual dental cleaning and examination
  enabled: true
  conditions:
    appointment_type: "dental"
    max_days_since_last: 182  # Every 6 months
  alert_priority: low
  alert_message: "Time for your dental cleaning. Regular care prevents problems."
```

## Medication Examples

### Medication Refill - Custom Days

```yaml
- id: critical_medication_refill
  name: Critical Medication Refill Alert
  type: medication_management
  description: Earlier alert for critical medications
  enabled: true
  conditions:
    days_supply_remaining: 14  # Alert 2 weeks before running out
  alert_priority: high
  alert_message: "Your medication supply is running low. Request refills now to avoid running out."
```

### Medication Review - More Frequent

```yaml
- id: polypharmacy_review
  name: Medication Review for Multiple Medications
  type: medication_management
  description: Quarterly medication review for patients on many medications
  enabled: true
  conditions:
    max_days_since_last_review: 90  # Every 3 months instead of annually
  alert_priority: high
  alert_message: "Time for your quarterly medication review to check for interactions and optimize your regimen."
```

## Preventive Care Examples

### Bone Density Scan (DEXA)

```yaml
- id: dexa_scan
  name: Bone Density Scan
  type: preventive_screening
  description: Osteoporosis screening with DEXA scan
  enabled: true
  conditions:
    screening_code: "77080"  # CPT code for DEXA scan
    max_days_since_last: 730  # Every 2 years
    min_age: 65
    gender: "female"
  alert_priority: medium
  alert_message: "Your bone density scan is due. Important for osteoporosis screening."
```

### Lung Cancer Screening (CT)

```yaml
- id: lung_cancer_screening
  name: Low-Dose CT Lung Cancer Screening
  type: preventive_screening
  description: Annual lung cancer screening for high-risk individuals
  enabled: true
  conditions:
    screening_code: "71271"  # CPT code for low-dose CT chest
    max_days_since_last: 365
    min_age: 50
    max_age: 80
    # Note: Should also check smoking history, but this requires custom logic
  alert_priority: high
  alert_message: "Your annual lung cancer screening is due. Early detection saves lives."
```

### Cervical Cancer Screening (Pap Smear)

```yaml
- id: pap_smear
  name: Cervical Cancer Screening
  type: preventive_screening
  description: Pap smear for cervical cancer screening
  enabled: true
  conditions:
    screening_code: "88175"  # CPT code for Pap smear
    max_days_since_last: 1095  # Every 3 years (for ages 21-65)
    min_age: 21
    max_age: 65
    gender: "female"
  alert_priority: high
  alert_message: "Your cervical cancer screening is due. Schedule your Pap test."
```

### Abdominal Aortic Aneurysm Screening

```yaml
- id: aaa_screening
  name: Abdominal Aortic Aneurysm Screening
  type: preventive_screening
  description: One-time AAA screening for at-risk men
  enabled: true
  conditions:
    screening_code: "76706"  # CPT code for AAA ultrasound
    max_days_since_last: 36500  # Essentially one-time (100 years)
    min_age: 65
    max_age: 75
    gender: "male"
  alert_priority: medium
  alert_message: "You're eligible for one-time AAA screening. Discuss with your doctor."
```

## Condition-Specific Examples

### Heart Failure Monitoring

```yaml
- id: heart_failure_weight_monitoring
  name: Daily Weight Monitoring (Heart Failure)
  type: vital_monitoring
  description: Daily weight checks for heart failure patients
  enabled: true
  conditions:
    vital_type: "weight"
    max_days_since_last: 7  # Weekly check in EMR
    applies_to_conditions:
      - "heart failure"
      - "congestive heart failure"
  alert_priority: high
  alert_message: "Record your weight this week. Daily monitoring helps detect fluid retention early."
```

### Kidney Disease Monitoring

```yaml
- id: kidney_function_monitoring
  name: Kidney Function Test (CKD)
  type: lab_work
  description: Regular kidney function monitoring for CKD
  enabled: true
  conditions:
    lab_test_code: "24362-6"  # LOINC code for Renal panel
    max_days_since_last: 90  # Every 3 months
    applies_to_conditions:
      - "chronic kidney disease"
      - "kidney disease"
  alert_priority: high
  alert_message: "Your kidney function test is due. Important for monitoring CKD progression."
```

### Asthma/COPD Monitoring

```yaml
- id: pulmonary_function_test
  name: Pulmonary Function Test
  type: preventive_screening
  description: Annual PFT for asthma/COPD patients
  enabled: true
  conditions:
    screening_code: "94060"  # CPT code for spirometry
    max_days_since_last: 365
    applies_to_conditions:
      - "asthma"
      - "COPD"
      - "chronic obstructive pulmonary disease"
  alert_priority: medium
  alert_message: "Your annual breathing test (PFT) is due to monitor your lung function."
```

### Rheumatoid Arthritis Monitoring

```yaml
- id: rheumatoid_arthritis_monitoring
  name: Inflammatory Markers Test
  type: lab_work
  description: Monitor disease activity in rheumatoid arthritis
  enabled: true
  conditions:
    lab_test_code: "4537-7"  # LOINC code for Sedimentation rate
    max_days_since_last: 90  # Every 3 months
    applies_to_conditions:
      - "rheumatoid arthritis"
      - "inflammatory arthritis"
  alert_priority: medium
  alert_message: "Your inflammatory markers test is due to monitor your arthritis."
```

## Age-Based Preventive Care

### Colorectal Cancer Screening (Earlier Start)

```yaml
- id: early_colonoscopy_screening
  name: Early Colorectal Cancer Screening
  type: preventive_screening
  description: Colonoscopy for those with family history
  enabled: true
  conditions:
    screening_code: "45378"  # CPT code for colonoscopy
    max_days_since_last: 3650  # 10 years
    min_age: 40  # Earlier than standard 45 if family history
  alert_priority: high
  alert_message: "Due to family history, your earlier colorectal screening is recommended."
```

### Prostate Exam (Clinical)

```yaml
- id: prostate_clinical_exam
  name: Clinical Prostate Examination
  type: follow_up_appointment
  description: Annual digital rectal exam for prostate health
  enabled: true
  conditions:
    appointment_type: "urologist"
    max_days_since_last: 365
    min_age: 50
    gender: "male"
  alert_priority: medium
  alert_message: "Your annual prostate examination is due."
```

## Finding Medical Codes

### LOINC Codes (Lab Tests)
Visit: https://loinc.org/
- Search for the test name
- Use the LOINC code in your rule

Common LOINC codes:
- `2093-3`: Total Cholesterol
- `4548-4`: HbA1c
- `1989-3`: Vitamin D, 25-hydroxy
- `2857-1`: PSA
- `718-7`: Hemoglobin
- `3016-3`: TSH
- `24362-6`: Renal panel

### CVX Codes (Vaccines)
Visit: https://www2a.cdc.gov/vaccines/iis/iisstandards/vaccines.asp

Common CVX codes:
- `141`: Influenza (seasonal)
- `115`: Tdap (tetanus, diphtheria, pertussis)
- `121`: Zoster (shingles)
- `33`: Pneumococcal polysaccharide
- `08`: Hepatitis B

### CPT Codes (Procedures)
Visit: https://www.ama-assn.org/practice-management/cpt

Common CPT codes:
- `77067`: Screening mammography
- `45378`: Colonoscopy
- `71271`: Low-dose CT chest (lung cancer screening)
- `76706`: AAA ultrasound screening
- `88175`: Pap smear

## Tips for Creating Custom Rules

1. **Start with existing rules**: Copy and modify similar rules
2. **Use correct codes**: Verify LOINC, CVX, or CPT codes are accurate
3. **Set appropriate frequencies**: Consider clinical guidelines
4. **Match priority to urgency**: High for critical, low for routine
5. **Write clear messages**: Explain why the test/appointment is important
6. **Test your rules**: Run `python main.py check` after adding rules
7. **Consult your doctor**: Verify monitoring frequency for your conditions

## Rule Testing Checklist

After adding a custom rule:

- [ ] Rule ID is unique
- [ ] Medical codes (LOINC/CVX/CPT) are correct
- [ ] Frequency (`max_days_since_last`) is appropriate
- [ ] Priority level matches clinical importance
- [ ] Conditions (age, gender, diagnoses) are accurate
- [ ] Alert message is clear and actionable
- [ ] `enabled: true` if you want it active
- [ ] Test with: `python main.py check`

## Getting Help with Custom Rules

If you need help:

1. Consult your healthcare provider about recommended monitoring
2. Check clinical guidelines for your conditions
3. Verify medical codes on official websites
4. Test rules before enabling continuous monitoring
5. Review logs if rules aren't triggering as expected

Remember: This system is a tool to help you stay on track, but always follow your healthcare provider's recommendations.
