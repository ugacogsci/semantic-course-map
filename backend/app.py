import json
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
# Enable CORS so React frontend can talk to Flask backend
CORS(app)

# Load the data once into memory when the app starts
def load_data():
    try:
        print("Loading database.json into memory...")
        with open('database_mapped_trimap_50_20_50.json', 'r', encoding='utf-8') as f: # Change filename for different datasets
            data = json.load(f)
            print(f"Successfully loaded {len(data)} courses")
            return data
    except FileNotFoundError:
        print("Error: database.json not found. Run scrape_uga.py")
        return []
    except json.JSONDecodeError:
        print("Error: database.json is empty or formatted incorrectly")
        return []

# This variable holds all course data in RAM
COURSE_DATA = load_data()


@app.route('/api/colleges', methods=['GET'])
def get_colleges():
    # Get all unique colleges from the data
    colleges = list({c.get('college', 'Unknown') for c in COURSE_DATA})
    # Sort them alphabetically
    colleges.sort()
    return jsonify([{"abbr_name": c, "full_name": c} for c in colleges])


@app.route('/api/terms', methods=['GET'])
def get_terms():
    college = request.args.get('college')
    
    # Find all unique terms for the selected college
    terms = list({
        c.get('term', 'Unknown') 
        for c in COURSE_DATA 
        if c.get('college') == college
    })
    terms.sort()
    return jsonify([{"name": t, "id": t} for t in terms])


@app.route('/api/subjects', methods=['GET'])
def get_subjects():
    college = request.args.get('college')
    term = request.args.get('term')
    
    # Find all unique subjects for the selected college and term
    subjects = list({
        c.get('subject', 'Unknown') 
        for c in COURSE_DATA 
        if c.get('college') == college and c.get('term') == term
    })
    subjects.sort()
    return jsonify([{"abbr_name": s, "full_name": s} for s in subjects])


@app.route('/api/courses', methods=['GET'])
def get_courses():
    college = request.args.get('college')
    term = request.args.get('term')
    subject = request.args.get('subject')
    
    # Filter the master list for the specific courses
    courses = [
        c for c in COURSE_DATA 
        if c.get('college') == college 
        and c.get('term') == term 
        and c.get('subject') == subject
    ]
    
    # Sort courses by number
    # Use lambda to safely handle if a number isn't a pure integer
    courses.sort(key=lambda x: x.get('number', '0'))
    
    return jsonify(courses)

@app.route('/api/all_courses', methods=['GET'])
def get_all_courses():
    # Sends the entire mapped database to the frontend for the massive graph
    return jsonify(COURSE_DATA)

if __name__ == '__main__':
    app.run(debug=True, port=5000)