#!/usr/bin/env python3

import PyPDF2
import re
import json

def analyze_acs_document(pdf_path, cert_type):
    """Perform detailed analysis of an ACS document"""
    
    with open(pdf_path, 'rb') as file:
        pdf = PyPDF2.PdfReader(file)
        
        # Extract text from all pages
        full_text = ""
        for i, page in enumerate(pdf.pages):
            page_text = page.extract_text()
            full_text += f"\n--- PAGE {i+1} ---\n{page_text}"
        
        # Define prefix based on certificate type
        prefix = {
            "private": "PA",
            "instrument": "IR", 
            "commercial": "CA"
        }[cert_type]
        
        # Find all ACS codes in the document
        code_pattern = rf"{prefix}\.([IVXLCDM]+)\.([A-Z])\.([KRS])(\d+)([a-z]?)"
        all_codes = re.findall(code_pattern, full_text)
        
        # Find Areas of Operation - look for the pattern in different formats
        areas = {}
        
        # Method 1: Look for "Area of Operation" pattern
        area_pattern = r"Area of Operation\s+([IVXLCDM]+)[.\s]+([^\n]+)"
        area_matches = re.findall(area_pattern, full_text)
        
        for area_num, area_name in area_matches:
            area_name = area_name.strip()
            if area_num not in areas:
                areas[area_num] = {
                    "name": area_name,
                    "tasks": {}
                }
        
        # Method 2: Find Tasks
        task_pattern = r"Task\s+([A-Z])[.\s]+([^\n]+)"
        
        # Look for tasks and try to associate them with areas
        for match in re.finditer(task_pattern, full_text):
            task_letter = match.group(1)
            task_name = match.group(2).strip()
            
            # Find the area this task belongs to by looking backwards
            position = match.start()
            text_before = full_text[:position]
            
            # Find the most recent area mention
            area_mentions = list(re.finditer(r"Area of Operation\s+([IVXLCDM]+)", text_before))
            if area_mentions:
                last_area = area_mentions[-1].group(1)
                if last_area in areas:
                    if task_letter not in areas[last_area]["tasks"]:
                        areas[last_area]["tasks"][task_letter] = {
                            "name": task_name,
                            "elements": {"K": [], "R": [], "S": []}
                        }
        
        # Method 3: Organize codes by area and task
        code_structure = {}
        for area, task, element_type, number, subletter in all_codes:
            if area not in code_structure:
                code_structure[area] = {}
            if task not in code_structure[area]:
                code_structure[area][task] = {"K": [], "R": [], "S": []}
            
            code = f"{prefix}.{area}.{task}.{element_type}{number}{subletter}"
            code_structure[area][task][element_type].append(code)
        
        # Merge information from both methods
        final_structure = {
            "certificate": cert_type,
            "prefix": prefix,
            "total_pages": len(pdf.pages),
            "areas": []
        }
        
        # Combine area names with code structure
        all_areas = set(list(areas.keys()) + list(code_structure.keys()))
        
        for area_num in sorted(all_areas, key=lambda x: ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"].index(x) if x in ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"] else 999):
            area_data = {
                "number": area_num,
                "name": areas.get(area_num, {}).get("name", "Unknown"),
                "tasks": []
            }
            
            # Get all tasks for this area
            area_tasks = set()
            if area_num in areas:
                area_tasks.update(areas[area_num]["tasks"].keys())
            if area_num in code_structure:
                area_tasks.update(code_structure[area_num].keys())
            
            for task_letter in sorted(area_tasks):
                task_data = {
                    "letter": task_letter,
                    "name": areas.get(area_num, {}).get("tasks", {}).get(task_letter, {}).get("name", "Unknown"),
                    "elements": code_structure.get(area_num, {}).get(task_letter, {"K": [], "R": [], "S": []})
                }
                area_data["tasks"].append(task_data)
            
            if area_data["tasks"]:
                final_structure["areas"].append(area_data)
        
        # Count totals
        total_k = sum(len(task["elements"]["K"]) for area in final_structure["areas"] for task in area["tasks"])
        total_r = sum(len(task["elements"]["R"]) for area in final_structure["areas"] for task in area["tasks"])
        total_s = sum(len(task["elements"]["S"]) for area in final_structure["areas"] for task in area["tasks"])
        
        final_structure["totals"] = {
            "knowledge": total_k,
            "risk_management": total_r,
            "skills": total_s,
            "total": total_k + total_r + total_s
        }
        
        return final_structure

def main():
    """Analyze all three ACS documents"""
    
    documents = [
        ("private", "/Users/charlie/repos/FlightLessons/private_airplane_acs_6.pdf"),
        ("instrument", "/Users/charlie/repos/FlightLessons/instrument_rating_airplane_acs_8.pdf"),
        ("commercial", "/Users/charlie/repos/FlightLessons/commercial_airplane_acs_7.pdf")
    ]
    
    results = {}
    
    for cert_type, pdf_path in documents:
        print(f"\nAnalyzing {cert_type.upper()} ACS document...")
        try:
            structure = analyze_acs_document(pdf_path, cert_type)
            results[cert_type] = structure
            
            print(f"  Certificate: {cert_type.upper()}")
            print(f"  Prefix: {structure['prefix']}")
            print(f"  Total Pages: {structure['total_pages']}")
            print(f"  Areas of Operation: {len(structure['areas'])}")
            print(f"  Total Elements: {structure['totals']['total']}")
            print(f"    - Knowledge: {structure['totals']['knowledge']}")
            print(f"    - Risk Management: {structure['totals']['risk_management']}")
            print(f"    - Skills: {structure['totals']['skills']}")
            
            # Show first few areas as examples
            if structure['areas']:
                print(f"\n  Example Areas:")
                for area in structure['areas'][:3]:
                    print(f"    {area['number']}. {area['name']} ({len(area['tasks'])} tasks)")
                    
        except Exception as e:
            print(f"  ERROR: {str(e)}")
            import traceback
            traceback.print_exc()
    
    # Save detailed results
    with open('/Users/charlie/repos/FlightLessons/acs_detailed_analysis.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    # Create comprehensive report
    create_comprehensive_report(results)

def create_comprehensive_report(results):
    """Create a detailed markdown report"""
    
    report = """# ACS Structure Analysis Report

## Executive Summary

This analysis examines three FAA Airman Certification Standards (ACS) documents to understand their structure and coding system for designing a training management system.

## Coding System

### Format
All ACS documents use a hierarchical coding system:

**`{Prefix}.{Area}.{Task}.{Element}{Number}[{Sub-letter}]`**

### Components
- **Prefix**: Certificate identifier
  - PA = Private Pilot for Airplane
  - IR = Instrument Rating
  - CA = Commercial Pilot for Airplane
  
- **Area**: Roman numeral (I, II, III, etc.) representing major areas of operation
  
- **Task**: Capital letter (A, B, C, etc.) representing specific tasks within an area
  
- **Element**: Type of requirement
  - K = Knowledge (what the applicant must understand)
  - R = Risk Management (hazards to identify and mitigate)
  - S = Skills (what the applicant must demonstrate)
  
- **Number**: Sequential number within element type
  
- **Sub-letter**: Optional sub-element for detailed breakdowns (a, b, c, etc.)

### Example
`PA.I.A.K1` = Private Pilot, Area I (Preflight Preparation), Task A (Pilot Qualifications), Knowledge element 1

## Document Overview

| Certificate | Prefix | Pages | Areas | Total Codes | K Elements | R Elements | S Elements |
|-------------|--------|-------|-------|-------------|------------|------------|------------|
"""
    
    for cert in ["private", "instrument", "commercial"]:
        if cert in results:
            data = results[cert]
            report += f"| {cert.capitalize()} | {data['prefix']} | {data['total_pages']} | "
            report += f"{len(data['areas'])} | {data['totals']['total']} | "
            report += f"{data['totals']['knowledge']} | {data['totals']['risk_management']} | "
            report += f"{data['totals']['skills']} |\n"
    
    report += "\n## Areas of Operation\n"
    
    for cert in ["private", "instrument", "commercial"]:
        if cert in results and results[cert]['areas']:
            report += f"\n### {cert.capitalize()} Pilot\n\n"
            for area in results[cert]['areas']:
                report += f"**Area {area['number']}: {area['name']}**\n"
                for task in area['tasks']:
                    k_count = len(task['elements']['K'])
                    r_count = len(task['elements']['R'])
                    s_count = len(task['elements']['S'])
                    report += f"- Task {task['letter']}: {task['name']} "
                    report += f"(K:{k_count}, R:{r_count}, S:{s_count})\n"
                report += "\n"
    
    report += """## Key Findings

1. **Consistent Structure**: All three certificates follow the same hierarchical organization and coding system.

2. **Progressive Complexity**: 
   - Private Pilot: Foundation skills and knowledge
   - Instrument Rating: Specialized IFR procedures and navigation
   - Commercial Pilot: Advanced maneuvers and professional standards

3. **Comprehensive Coverage**: Each task addresses:
   - Knowledge requirements (theoretical understanding)
   - Risk management (safety and decision-making)
   - Skills (practical demonstration)

4. **Training System Design Implications**:
   - Use the ACS codes as unique identifiers for training items
   - Track progress at the element level (K, R, S)
   - Allow mapping of training activities to multiple ACS codes
   - Support prerequisite relationships between elements
   - Enable progress tracking across all three certificates

## Implementation Recommendations

1. **Database Structure**:
   - Store ACS codes as primary references
   - Create hierarchical relationships (Area → Task → Element)
   - Link training materials to specific codes

2. **User Interface**:
   - Display progress by Area and Task
   - Show K/R/S completion separately
   - Allow filtering by certificate level

3. **Progress Tracking**:
   - Track completion at the element level
   - Calculate task completion based on all elements
   - Roll up to area and certificate completion

4. **Cross-Certificate Mapping**:
   - Identify common elements across certificates
   - Show how Private elements support Commercial requirements
   - Track cumulative progress across all ratings
"""
    
    with open('/Users/charlie/repos/FlightLessons/acs_comprehensive_report.md', 'w') as f:
        f.write(report)
    
    print("\nComprehensive report saved to acs_comprehensive_report.md")

if __name__ == "__main__":
    main()