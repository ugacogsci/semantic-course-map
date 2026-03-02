import json
import requests
from bs4 import BeautifulSoup
import time

def enrich_course_data():
    print("Loading database.json...")
    try:
        with open('database.json', 'r', encoding='utf-8') as f:
            courses = json.load(f)
    except FileNotFoundError:
        print("Error: database.json not found. Run the first scraper first")
        return

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:148.0) Gecko/20100101 Firefox/148.0"
    }

    # Loop through courses
    for i, course in enumerate(courses): # Change this to `courses[:10]` to test a small batch first
        url = course.get("url")
        
        # Skip if no URL or if we already scraped this one (resume capability)
        if not url or "course_objectives" in course:
            continue
            
        print(f"[{i+1}/{len(courses)}] Fetching details for {course['subject']} {course['number']}...")
        
        try:
            response = requests.get(url, headers=headers)
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Extract Course Objectives
            # Find the header <p id="courseObjectives">
            obj_header = soup.find('p', id='courseObjectives')
            obj_text = ""
            
            # If header exists, find the <ul> immediately following it
            if obj_header:
                obj_list = obj_header.find_next_sibling('ul')
                if obj_list:
                    # Get all <li> items and join them into a paragraph
                    items = [li.get_text(strip=True) for li in obj_list.find_all('li')]
                    obj_text = " ".join(items)

            # Extract topical outline
            # Find the header <p id="topicalOutline">
            out_header = soup.find('p', id='topicalOutline')
            out_text = ""
            
            if out_header:
                out_list = out_header.find_next_sibling('ul')
                if out_list:
                    items = [li.get_text(strip=True) for li in out_list.find_all('li')]
                    out_text = " ".join(items)
            
            # Save the new deep data
            course["course_objectives"] = obj_text
            course["topical_outline"] = out_text
            
            # Be polite to the server
            time.sleep(0.5)
            
        except Exception as e:
            print(f"Failed to fetch details for {course['subject']} {course['number']}: {e}")
            course["course_objectives"] = ""
            course["topical_outline"] = ""

        # Save progress every 50 courses so data isn't lost if it crashes
        if i % 50 == 0:
             with open('database_enriched.json', 'w', encoding='utf-8') as f:
                json.dump(courses, f, indent=4, ensure_ascii=False)

    # Final Save
    print("Saving final enriched database...")
    with open('database_enriched.json', 'w', encoding='utf-8') as f:
        json.dump(courses, f, indent=4, ensure_ascii=False)
        
    print("Deep scraping complete")

if __name__ == "__main__":
    enrich_course_data()