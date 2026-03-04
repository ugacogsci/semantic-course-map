import json
import os
from flask import Flask, jsonify, request
from flask_cors import CORS
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Import RAG module
from rag import get_retrieval_results, initialize as initialize_rag

app = Flask(__name__)
# Enable CORS so React frontend can talk to Flask backend
CORS(app)

# Configure Gemini API
# Set custom key with: export GEMINI_API_KEY="your-key"
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', 'AIzaSyDPGcsdtnzaeoCYy-q8gCVNHATYioYeo7M')
GEMINI_MODEL = "gemini-2.5-flash"

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    print("Warning: GEMINI_API_KEY not configured. /api/ask will fall back to basic responses.")

# RAG Configuration
RAG_TOP_K = 5  # Number of courses to retrieve for context

# Load the data once into memory when the app starts
def load_data():
    try:
        print("Loading database.json into memory...")
        with open('database.json', 'r', encoding='utf-8') as f:
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


@app.route('/api/ask', methods=['POST'])
def ask_chatbot():
    """
    RAG-powered chatbot endpoint for course recommendations.
    
    Accepts JSON: { "question": "..." }
    Returns JSON: { "answer": "...", "sources": [...] }
    """
    data = request.get_json()
    
    if not data or 'question' not in data:
        return jsonify({'error': 'Missing "question" field in request body'}), 400
    
    question = data['question'].strip()
    
    if not question:
        return jsonify({'error': 'Question cannot be empty'}), 400
    
    try:
        # Retrieve relevant courses using RAG
        retrieval = get_retrieval_results(question, top_k=RAG_TOP_K)
        context = retrieval['context']
        sources = retrieval['results']
        
        # Build the prompt for the LLM
        system_prompt = """You help students explore University of Georgia (UGA) courses. Your role is to recommend courses based on the student's interests and questions. Use the provided course information to give accurate, helpful recommendations. If the user’s (student’s) question or interests are unclear, ask a clarifying question before giving recommendations. If information is missing or not included in the provided data, state this clearly and do not make up details. Always mention specific course codes (e.g., CSCI 1301) when recommending courses. Be concise but informative in your responses."""

        user_prompt = f"""Based on the following course information, please answer this student's question:

STUDENT QUESTION: {question}

RELEVANT COURSES:
{context}

Please provide a helpful response that:
1. Directly addresses the student's question
2. Recommends specific courses from the provided information
3. Explains why each recommended course might be a good fit
"""

        # Check if Gemini API key is configured
        if not GEMINI_API_KEY:
            # Fallback response without LLM
            course_list = "\n".join([
                f"• {r['course'].get('subject', '')} {r['course'].get('number', '')}: {r['course'].get('title', '')} (Relevance: {r['similarity']:.0%})"
                for r in sources
            ])
            answer = f"""Based on your question about "{question}", here are the most relevant courses I found:

{course_list}

Note: For a more detailed, personalized response, please configure the Gemini API key."""
        else:
            # Call Gemini API
            model = genai.GenerativeModel(model_name=GEMINI_MODEL)
            response = model.generate_content(
                contents=[
                    system_prompt,
                    user_prompt
                ],
                generation_config={
                    "temperature": 0.7,
                    "max_output_tokens": 1000
                }
            )
            answer = (response.text or "Unable to generate a response.").strip()
        
        # Format source courses for response
        formatted_sources = [
            {
                'code': f"{r['course'].get('subject', '')} {r['course'].get('number', '')}",
                'title': r['course'].get('title', ''),
                'similarity': round(r['similarity'] * 100, 1)
            }
            for r in sources
        ]
        
        return jsonify({
            'answer': answer,
            'sources': formatted_sources
        })
        
    except Exception as e:
        print(f"Error in /api/ask: {str(e)}")
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500


if __name__ == '__main__':
    # Initialize RAG system on startup
    print("Initializing RAG system...")
    try:
        initialize_rag()
    except Exception as e:
        print(f"Warning: RAG initialization failed: {e}")
        print("The /api/ask endpoint may not work correctly.")
    
    app.run(debug=True, port=5000)