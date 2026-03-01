from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
# Enable CORS so React frontend can talk to Flask backend without security errors
CORS(app) 

@app.route('/api/status', methods=['GET'])
def get_status():
    # Dummy data
    return jsonify({
        "status": "success",
        "message": "Hello from the Flask backend",
        "courses_loaded": 0
    })
 
if __name__ == '__main__':
    # Runs on port 5000 by default
    app.run(debug=True, port=5000)