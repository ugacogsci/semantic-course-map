import json
import os
from flask import Flask, jsonify, request
from flask_cors import CORS
import openai

# Import RAG module
from rag import get_retrieval_results, initialize as initialize_rag

app = Flask(__name__)
# Enable CORS so React frontend can talk to Flask backend
CORS(app)

# Configure OpenAI API
# Set your API key as environment variable: export OPENAI_API_KEY="your-key"
openai.api_key = os.getenv('OPENAI_API_KEY', '')

# RAG Configuration
RAG_TOP_K = 5  # Number of courses to retrieve for context
LLM_MODEL = "gpt-3.5-turbo"  # or "gpt-4" for better responses

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
        system_prompt = """You are a helpful academic advisor for the University of Georgia (UGA). 
Your role is to recommend courses based on the student's interests and questions.
Use the provided course information to give accurate, helpful recommendations.
Always mention specific course codes (e.g., CSCI 1301) when recommending courses.
Be concise but informative in your responses."""

        user_prompt = f"""Based on the following course information, please answer this student's question:

STUDENT QUESTION: {question}

RELEVANT COURSES:
{context}

Please provide a helpful response that:
1. Directly addresses the student's question
2. Recommends specific courses from the provided information
3. Explains why each recommended course might be a good fit
4. Mentions any prerequisites or important details if available"""

        # Check if OpenAI API key is configured
        if not openai.api_key:
            # Fallback response without LLM
            course_list = "\n".join([
                f"• {r['course'].get('subject', '')} {r['course'].get('number', '')}: {r['course'].get('title', '')} (Relevance: {r['similarity']:.0%})"
                for r in sources
            ])
            answer = f"""Based on your question about "{question}", here are the most relevant courses I found:

{course_list}

Note: For a more detailed, personalized response, please configure the OpenAI API key."""
        else:
            # Call OpenAI API
            response = openai.chat.completions.create(
                model=LLM_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7,
                max_tokens=1000
            )
            answer = response.choices[0].message.content
        
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