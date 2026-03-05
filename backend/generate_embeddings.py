import json
import time
import numpy as np
from sentence_transformers import SentenceTransformer

def generate_cache():
    print("Loading database_enriched.json...")
    try:
        with open('database_enriched.json', 'r', encoding='utf-8') as f:
            courses = json.load(f)
    except FileNotFoundError:
        print("Error: database_enriched.json not found")
        return

    # Prepare text
    print(f"Preparing {len(courses)} text strings...")
    texts_to_embed = []
    for c in courses:
        concept_text = f"Course: {c.get('title', '')}. " \
                       f"Description: {c.get('description', '')}. " \
                       f"Objectives: {c.get('course_objectives', '')}. " \
                       f"Topics: {c.get('topical_outline', '')}."
        texts_to_embed.append(concept_text)

    # Generate Embeddings
    print("Loading AI Model (all-MiniLM-L6-v2)...")
    model = SentenceTransformer('all-MiniLM-L6-v2') 
    
    print("Generating vector embeddings...")
    start_time = time.time()
    embeddings = model.encode(texts_to_embed, show_progress_bar=True)
    print(f"Generated embeddings in {round(time.time() - start_time, 2)} seconds.")

    # Save the cache
    print("Saving binary cache files...")
    # Save the huge math matrix to a .npy file (loads 100x faster than JSON)
    np.save('embeddings_cache.npy', embeddings)
    
    # We must also save the course list in the exact same order so we can match them up later
    with open('courses_cache.json', 'w', encoding='utf-8') as f:
        json.dump(courses, f, indent=4, ensure_ascii=False)

    print("Cache complete. You can now run the mapping scripts.")

if __name__ == "__main__":
    generate_cache()