"""
RAG (Retrieval-Augmented Generation) module for course recommendations.
Loads course data, generates embeddings, and provides semantic search functionality.
"""

import json
import os
import numpy as np
from sentence_transformers import SentenceTransformer

# Configuration
EMBEDDING_MODEL = 'all-mpnet-base-v2'  # High-quality semantic similarity model
EMBEDDINGS_CACHE_FILE = 'course_embeddings.npy'
COURSE_DATA_FILE = 'database_enriched.json'

# Global variables to hold preloaded data
_model = None
_embeddings = None
_courses = None


def _get_course_text(course: dict) -> str:
    """
    Combine course fields into a single text for embedding.
    """
    return (
        f"Course: {course.get('subject', '')} {course.get('number', '')} - {course.get('title', '')}. "
        f"Description: {course.get('description', '')}. "
        f"Objectives: {course.get('course_objectives', '')}. "
        f"Topics: {course.get('topical_outline', '')}."
    )


def load_model():
    """
    Load the sentence transformer model.
    """
    global _model
    if _model is None:
        print(f"Loading embedding model: {EMBEDDING_MODEL}...")
        _model = SentenceTransformer(EMBEDDING_MODEL)
        print("Model loaded successfully.")
    return _model


def load_courses():
    """
    Load course data from JSON file.
    """
    global _courses
    if _courses is None:
        data_path = os.path.join(os.path.dirname(__file__), COURSE_DATA_FILE)
        print(f"Loading course data from {data_path}...")
        with open(data_path, 'r', encoding='utf-8') as f:
            _courses = json.load(f)
        print(f"Loaded {len(_courses)} courses.")
    return _courses


def load_or_generate_embeddings():
    """
    Load embeddings from cache if available, otherwise generate them.
    """
    global _embeddings
    
    if _embeddings is not None:
        return _embeddings
    
    cache_path = os.path.join(os.path.dirname(__file__), EMBEDDINGS_CACHE_FILE)
    courses = load_courses()
    
    # Try to load from cache
    if os.path.exists(cache_path):
        print(f"Loading cached embeddings from {cache_path}...")
        _embeddings = np.load(cache_path)
        
        # Verify embeddings match course count
        if len(_embeddings) == len(courses):
            print(f"Loaded {len(_embeddings)} cached embeddings.")
            return _embeddings
        else:
            print("Cache size mismatch. Regenerating embeddings...")
    
    # Generate embeddings
    print("Generating embeddings for all courses (this may take a few minutes)...")
    model = load_model()
    
    texts = [_get_course_text(course) for course in courses]
    _embeddings = model.encode(texts, show_progress_bar=True, convert_to_numpy=True)
    
    # Cache for future use
    print(f"Saving embeddings to {cache_path}...")
    np.save(cache_path, _embeddings)
    
    print(f"Generated and cached {len(_embeddings)} embeddings.")
    return _embeddings


def initialize():
    """
    Initialize the RAG system by loading model, courses, and embeddings.
    Call this at app startup to preload everything.
    """
    load_model()
    load_courses()
    load_or_generate_embeddings()
    print("RAG system initialized and ready.")


def cosine_similarity(query_embedding: np.ndarray, corpus_embeddings: np.ndarray) -> np.ndarray:
    """
    Compute cosine similarity between a query embedding and all corpus embeddings.
    """
    # Normalize vectors
    query_norm = query_embedding / np.linalg.norm(query_embedding)
    corpus_norms = corpus_embeddings / np.linalg.norm(corpus_embeddings, axis=1, keepdims=True)
    
    # Compute dot product (cosine similarity for normalized vectors)
    similarities = np.dot(corpus_norms, query_norm)
    return similarities


def search_courses(query: str, top_k: int = 5) -> list:
    """
    Search for courses semantically similar to the query.
    
    Args:
        query: User's question or search query
        top_k: Number of top results to return
    
    Returns:
        List of (course, similarity_score) tuples
    """
    model = load_model()
    embeddings = load_or_generate_embeddings()
    courses = load_courses()
    
    # Embed the query
    query_embedding = model.encode(query, convert_to_numpy=True)
    
    # Compute similarities
    similarities = cosine_similarity(query_embedding, embeddings)
    
    # Get top-k indices
    top_indices = np.argsort(similarities)[::-1][:top_k]
    
    # Return courses with their similarity scores
    results = []
    for idx in top_indices:
        results.append({
            'course': courses[idx],
            'similarity': float(similarities[idx])
        })
    
    return results


def build_context(results: list) -> str:
    """
    Build a text context block from retrieved courses for the LLM prompt.
    
    Args:
        results: List of search results from search_courses()
    
    Returns:
        Formatted string with course descriptions
    """
    context_parts = []
    
    for i, result in enumerate(results, 1):
        course = result['course']
        similarity = result['similarity']
        
        course_block = f"""
Course {i} (Relevance: {similarity:.2%}):
- Code: {course.get('subject', 'N/A')} {course.get('number', 'N/A')}
- Title: {course.get('title', 'N/A')}
- Description: {course.get('description', 'No description available.')}
- Objectives: {course.get('course_objectives', 'Not specified.')}
- Topics: {course.get('topical_outline', 'Not specified.')}
"""
        context_parts.append(course_block.strip())
    
    return "\n\n".join(context_parts)


def get_retrieval_results(query: str, top_k: int = 5) -> dict:
    """
    Main function to retrieve courses and build context for RAG.
    
    Args:
        query: User's question
        top_k: Number of courses to retrieve
    
    Returns:
        Dictionary containing retrieved courses and formatted context
    """
    results = search_courses(query, top_k=top_k)
    context = build_context(results)
    
    return {
        'results': results,
        'context': context,
        'query': query
    }


if __name__ == "__main__":
    # Test the RAG system
    initialize()
    
    test_query = "I want to learn about machine learning and artificial intelligence"
    print(f"\nTest query: {test_query}\n")
    
    retrieval = get_retrieval_results(test_query, top_k=3)
    
    print("Retrieved courses:")
    for result in retrieval['results']:
        course = result['course']
        print(f"  - {course.get('subject')} {course.get('number')}: {course.get('title')} (similarity: {result['similarity']:.2%})")
    
    print("\nContext for LLM:")
    print(retrieval['context'])
