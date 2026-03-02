import requests
from bs4 import BeautifulSoup
import json
import time

def scrape_all_uga_courses():
    all_courses =[]
    total_pages = 783 
    
    url = "https://bulletin.uga.edu/Course/_ViewAllCourses"

    # Mimic the exact browser headers so the server accepts the request
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:148.0) Gecko/20100101 Firefox/148.0", # This is straight from my manual webpage access
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://bulletin.uga.edu/Course/Index"
    }

    for page in range(1, total_pages + 1):
        print(f"Scraping page {page} of {total_pages}...")
        
        # Here is the exact payload discovered in the Request tab
        payload = {
            "page": str(page),
            "keyword": "",
            "enteredCoursePrefix": "",
            "enteredCourseNumber": ""
        }
        
        try:
            # Send the POST request with the headers and payload
            response = requests.post(url, headers=headers, data=payload)
            
            if response.status_code != 200:
                print(f"Failed to fetch page {page}. Status code: {response.status_code}")
                continue

            # Parse the HTML fragment
            soup = BeautifulSoup(response.text, 'html.parser')
            course_cards = soup.find_all('div', class_='course-card')
            
            if not course_cards:
                print(f"No courses found on page {page}. Stopping.")
                break
            
            for card in course_cards:
                # Extract Course Code (e.g., "AAEC 2580")
                course_code_element = card.find('a', class_='crn')
                if not course_code_element:
                    continue
                course_code_text = course_code_element.text.strip()
                
                parts = course_code_text.split(" ")
                subject = parts[0]
                number = parts[1] if len(parts) > 1 else ""
                
                # Extract Course Title
                title_element = card.find('p', class_='large mw')
                title = title_element.text.strip() if title_element else "Unknown Title"
                
                # Extract Course Description
                bottom_div = card.find('div', class_='course-card--bottom')
                desc_element = bottom_div.find('p') if bottom_div else None
                description = desc_element.text.strip() if desc_element else "No description available."
                
                # Grab the link
                link_element = card.find('a', class_='full-description')
                course_url_path = link_element['href'] if link_element else ""

                all_courses.append({
                    "college": "UGA",
                    "term": "All", # Since we are grabbing everything
                    "subject": subject,
                    "number": number,
                    "title": title,
                    "description": description,
                    "url": f"https://bulletin.uga.edu{course_url_path}"
                })
                
            # Sleep for 1 second so we don't accidentally DDoS the UGA Bulletin
            time.sleep(1) 
            
        except Exception as e:
            print(f"Error on page {page}: {e}")
            
    return all_courses

if __name__ == "__main__":
    courses_data = scrape_all_uga_courses()
    
    # Save directly to the file Flask backend is already looking for
    with open("database.json", "w", encoding="utf-8") as f:
        json.dump(courses_data, f, indent=4, ensure_ascii=False)
        
    print(f"\nExtracted {len(courses_data)} courses and saved to database.json.")