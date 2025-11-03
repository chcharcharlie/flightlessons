#!/usr/bin/env python3

import PyPDF2
import re
import json

def extract_acs_structure(pdf_path, certificate_type):
    """Extract the ACS structure from a PDF file"""
    
    structure = {
        "certificate": certificate_type,
        "total_pages": 0,
        "areas_of_operation": [],
        "coding_pattern": "",
        "element_types": {"K": "Knowledge", "R": "Risk Management", "S": "Skills"}
    }
    
    with open(pdf_path, 'rb') as file:
        pdf = PyPDF2.PdfReader(file)
        structure["total_pages"] = len(pdf.pages)
        
        # Extract all text
        full_text = ""
        for page in pdf.pages:
            full_text += page.extract_text() + "\n"
        
        # Find Areas of Operation - handle both formats
        area_pattern = r"Area of Operation\s+([IVXLCDM]+)\.\s*(.+?)(?=\n|$)"
        area_matches = re.findall(area_pattern, full_text, re.MULTILINE)
        
        # If no matches, try alternative format
        if not area_matches:
            area_pattern = r"Area of Operation\s+([IVXLCDM]+)\.\s*(.+?)(?=Area of Operation|$)"
            area_matches = re.findall(area_pattern, full_text, re.DOTALL)
        
        # Extract tasks and codes for each area
        for area_num, area_name in area_matches:
            area = {
                "number": area_num,
                "name": area_name.strip(),
                "tasks": []
            }
            
            # Find tasks within this area
            task_pattern = rf"Task\s+([A-Z])\.\s+(.+?)(?=\n)"
            
            # Extract a section of text after this area
            area_start = full_text.find(f"Area of Operation {area_num}")
            if area_start != -1:
                # Get next area start or end of document
                next_area_pattern = r"Area of Operation\s+[IVXLCDM]+"
                next_match = re.search(next_area_pattern, full_text[area_start + 100:])
                if next_match:
                    area_end = area_start + 100 + next_match.start()
                else:
                    area_end = len(full_text)
                
                area_text = full_text[area_start:area_end]
                
                # Find tasks in this area
                task_matches = re.findall(task_pattern, area_text)
                
                for task_letter, task_name in task_matches:
                    task = {
                        "letter": task_letter,
                        "name": task_name.strip(),
                        "codes": {"K": [], "R": [], "S": []}
                    }
                    
                    # Find all ACS codes for this task
                    prefix = certificate_type[:2].upper() if certificate_type != "instrument" else "IR"
                    code_pattern = rf"{prefix}\.{area_num}\.{task_letter}\.(K|R|S)(\d+[a-z]?)"
                    code_matches = re.findall(code_pattern, area_text)
                    
                    for element_type, element_num in code_matches:
                        code = f"{prefix}.{area_num}.{task_letter}.{element_type}{element_num}"
                        task["codes"][element_type].append(code)
                    
                    if task["codes"]["K"] or task["codes"]["R"] or task["codes"]["S"]:
                        area["tasks"].append(task)
            
            if area["tasks"]:
                structure["areas_of_operation"].append(area)
        
        # Determine coding pattern
        if certificate_type == "private":
            structure["coding_pattern"] = "PA.{Area}.{Task}.{Element}{Number}[{Sub-letter}]"
        elif certificate_type == "instrument":
            structure["coding_pattern"] = "IR.{Area}.{Task}.{Element}{Number}[{Sub-letter}]"
        elif certificate_type == "commercial":
            structure["coding_pattern"] = "CA.{Area}.{Task}.{Element}{Number}[{Sub-letter}]"
    
    return structure

def analyze_all_acs():
    """Analyze all three ACS documents"""
    
    files = {
        "private": "/Users/charlie/repos/FlightLessons/private_airplane_acs_6.pdf",
        "instrument": "/Users/charlie/repos/FlightLessons/instrument_rating_airplane_acs_8.pdf",
        "commercial": "/Users/charlie/repos/FlightLessons/commercial_airplane_acs_7.pdf"
    }
    
    results = {}
    
    for cert_type, file_path in files.items():
        print(f"\nAnalyzing {cert_type.upper()} ACS...")
        try:
            structure = extract_acs_structure(file_path, cert_type)
            results[cert_type] = structure
            
            # Print summary
            print(f"  - Total pages: {structure['total_pages']}")
            print(f"  - Areas of Operation: {len(structure['areas_of_operation'])}")
            print(f"  - Coding pattern: {structure['coding_pattern']}")
            
            # Count total elements
            total_k = total_r = total_s = 0
            for area in structure['areas_of_operation']:
                for task in area['tasks']:
                    total_k += len(task['codes']['K'])
                    total_r += len(task['codes']['R'])
                    total_s += len(task['codes']['S'])
            
            print(f"  - Total elements: K={total_k}, R={total_r}, S={total_s}")
            
        except Exception as e:
            print(f"  ERROR: {str(e)}")
            results[cert_type] = {"error": str(e)}
    
    # Save detailed results
    with open('/Users/charlie/repos/FlightLessons/acs_structure_analysis.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    # Create summary report
    create_summary_report(results)
    
    return results

def create_summary_report(results):
    """Create a markdown summary report"""
    
    report = """# ACS Structure Analysis Summary

## Overview

This analysis examines the structure of three FAA Airman Certification Standards (ACS) documents:
- Private Pilot for Airplane Category (FAA-S-ACS-6C)
- Instrument Rating – Airplane (FAA-S-ACS-8C)
- Commercial Pilot for Airplane Category (FAA-S-ACS-7B)

## Coding System

All three documents use a consistent hierarchical coding system:

**Format:** `{Prefix}.{Area}.{Task}.{Element}{Number}[{Sub-letter}]`

Where:
- **Prefix:** Certificate type (PA = Private, IR = Instrument, CA = Commercial)
- **Area:** Roman numeral (I, II, III, etc.)
- **Task:** Capital letter (A, B, C, etc.)
- **Element:** Type of requirement
  - K = Knowledge
  - R = Risk Management
  - S = Skills
- **Number:** Sequential number within element type
- **Sub-letter:** Optional sub-element (a, b, c, etc.)

Example: `PA.I.A.K1` = Private Pilot, Area I, Task A, Knowledge element 1

## Certificate Comparison

"""
    
    # Add comparison table
    report += "| Certificate | Pages | Areas | Total Tasks | K Elements | R Elements | S Elements |\n"
    report += "|------------|-------|-------|-------------|------------|------------|------------|\n"
    
    for cert_type in ['private', 'instrument', 'commercial']:
        if cert_type in results and 'areas_of_operation' in results[cert_type]:
            data = results[cert_type]
            total_tasks = sum(len(area['tasks']) for area in data['areas_of_operation'])
            total_k = sum(len(task['codes']['K']) for area in data['areas_of_operation'] for task in area['tasks'])
            total_r = sum(len(task['codes']['R']) for area in data['areas_of_operation'] for task in area['tasks'])
            total_s = sum(len(task['codes']['S']) for area in data['areas_of_operation'] for task in area['tasks'])
            
            report += f"| {cert_type.capitalize()} | {data['total_pages']} | {len(data['areas_of_operation'])} | "
            report += f"{total_tasks} | {total_k} | {total_r} | {total_s} |\n"
    
    # Add Areas of Operation for each certificate
    report += "\n## Areas of Operation by Certificate\n"
    
    for cert_type in ['private', 'instrument', 'commercial']:
        if cert_type in results and 'areas_of_operation' in results[cert_type]:
            report += f"\n### {cert_type.capitalize()} Pilot\n\n"
            data = results[cert_type]
            for area in data['areas_of_operation']:
                report += f"- **Area {area['number']}: {area['name']}**\n"
                for task in area['tasks']:
                    report += f"  - Task {task['letter']}: {task['name']}\n"
    
    # Add common patterns section
    report += "\n## Common Patterns\n\n"
    report += "1. **Structure:** All certificates follow the same Area → Task → Element hierarchy\n"
    report += "2. **Element Types:** Each task contains Knowledge (K), Risk Management (R), and Skills (S) elements\n"
    report += "3. **Progressive Complexity:** Commercial builds upon Private, adding more complex maneuvers\n"
    report += "4. **Instrument Focus:** Instrument rating emphasizes procedures and navigation rather than maneuvers\n"
    
    # Save report
    with open('/Users/charlie/repos/FlightLessons/acs_structure_summary.md', 'w') as f:
        f.write(report)
    
    print("\nSummary report saved to acs_structure_summary.md")

if __name__ == "__main__":
    analyze_all_acs()