import json
from flask import Flask, jsonify, request
from flask_cors import CORS
import os

app = Flask(__name__)
# Enable CORS so React frontend can talk to Flask backend
CORS(app)

# ─── Global Cache Store ───
# We use a dictionary to store loaded maps in RAM so switching is instant
APP_CACHE = {
    "current_map": None,
    "data":[]
}

# MUST exactly match the 'value' fields in your React dropdown!
ALLOWED_MAPS =[
    'database_mapped_umap_15', 
    'database_mapped_umap_40', 
    'database_mapped_pacmap_o', 
    'database_mapped_trimap_500_100_100', 
    'database_mapped_trimap_50_20_10', 
    'database_mapped_trimap_30_20_10',
    'database_mapped_tsne_100', 
    'database_mapped_tsne_500', 
    'database_mapped_tsne_1000'
]

# Get the absolute path to the directory where app.py lives
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def get_data_by_map(map_type):
    """Helper to load data if it's not already in the cache."""
    if map_type not in ALLOWED_MAPS:
        print(f"Security Block: '{map_type}' is not an allowed file.")
        return None

    if APP_CACHE["current_map"] == map_type:
        return APP_CACHE["data"]
    
    # Build the absolute path to the JSON file
    file_path = os.path.join(BASE_DIR, f'{map_type}.json')

    # Otherwise, load the requested map from the hard drive
    try:
        print(f"Loading {map_type}.json into RAM...")
        with open(f'{map_type}.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
            APP_CACHE["current_map"] = map_type
            APP_CACHE["data"] = data
            print(f"Successfully loaded {len(data)} courses")
            return data
    except FileNotFoundError:
        print(f"Error: {map_type}.json not found in the backend folder")
        return None

# ─── API ROUTES ───

@app.route('/api/all_courses', methods=['GET'])
def get_all_courses():
    map_type = request.args.get('map_type', 'database_mapped_umap_15')
    data = get_data_by_map(map_type)
    if data is None: 
        return jsonify({"error": "Map not found"}), 404
    return jsonify(data)

@app.route('/api/colleges', methods=['GET'])
def get_colleges():
    map_type = request.args.get('map_type', 'database_mapped_umap_15')
    data = get_data_by_map(map_type)
    if data is None: return jsonify([]), 404
    
    # Get all unique colleges from the data
    colleges = list({c.get('college', 'Unknown') for c in data})
    # Sort them alphabetically
    colleges.sort()
    return jsonify([{"abbr_name": c, "full_name": c} for c in colleges])

@app.route('/api/terms', methods=['GET'])
def get_terms():
    map_type = request.args.get('map_type', 'database_mapped_umap_15')
    college = request.args.get('college')
    data = get_data_by_map(map_type)
    if data is None: return jsonify([]), 404
    
    # Find all unique terms for the selected college
    terms = list({c.get('term', 'Unknown') for c in data if c.get('college') == college})
    terms.sort()
    return jsonify([{"name": t, "id": t} for t in terms])

@app.route('/api/subjects', methods=['GET'])
def get_subjects():
    map_type = request.args.get('map_type', 'database_mapped_umap_15')
    college = request.args.get('college')
    term = request.args.get('term')
    data = get_data_by_map(map_type)
    if data is None: return jsonify([]), 404
    
    # Find all unique subjects for the selected college and term
    subjects = list({c.get('subject', 'Unknown') for c in data if c.get('college') == college and c.get('term') == term})
    subjects.sort()
    return jsonify([{"abbr_name": s, "full_name": s} for s in subjects])

@app.route('/api/courses', methods=['GET'])
def get_courses():
    map_type = request.args.get('map_type', 'database_mapped_umap_15')
    college = request.args.get('college')
    term = request.args.get('term')
    subject = request.args.get('subject')
    data = get_data_by_map(map_type)
    if data is None: return jsonify([]), 404
    
    # Filter the master list for the specific courses
    courses =[c for c in data if c.get('college') == college and c.get('term') == term and c.get('subject') == subject]
    # Sort courses by number
    # Use lambda to safely handle if a number isn't a pure integer
    courses.sort(key=lambda x: x.get('number', '0'))
    # Sends the entire mapped database to the frontend for the massive graph
    return jsonify(courses)

if __name__ == '__main__':
    app.run(debug=True, port=5000)