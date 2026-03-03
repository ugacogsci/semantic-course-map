import json
import time
from sentence_transformers import SentenceTransformer
import umap
import numpy as np

def generate_semantic_map():
    print("Loading database_enriched.json...")
    try:
        with open('database_enriched.json', 'r', encoding='utf-8') as f:
            courses = json.load(f)
    except FileNotFoundError:
        print("Error: database_enriched.json not found!")
        return

    # courses = courses[:500] 

    print(f"Preparing {len(courses)} courses for the AI...")
    
    # The title, description, objectives, and outline are combined so the AI can understand what the class is about in one string
    texts_to_embed =[]
    for c in courses:
        concept_text = f"Course: {c.get('title', '')}. " \
                       f"Description: {c.get('description', '')}. " \
                       f"Objectives: {c.get('course_objectives', '')}. " \
                       f"Topics: {c.get('topical_outline', '')}."
        texts_to_embed.append(concept_text)

    # Generate AI Embeddings
    print("Loading local HuggingFace Embedding Model (all-MiniLM-L6-v2)...")
    # This model is small and fast
    model = SentenceTransformer('all-MiniLM-L6-v2') 
    
    print("Generating vector embeddings...")
    start_time = time.time()
    embeddings = model.encode(texts_to_embed, show_progress_bar=True)
    print(f"Generated {len(embeddings)} embeddings in {round(time.time() - start_time, 2)} seconds.")

    # UMAP Dimensionality Reduction (384 Dimensions -> 2 Dimensions)
    print("Running UMAP...")
    # n_neighbors controls how local/global the clusters are. 15 is a great default.
    # min_dist controls how tightly packed the nodes are. 0.1 makes distinct clusters.
    reducer = umap.UMAP(n_neighbors=15, min_dist=0.1, metric='cosine', random_state=42)
    
    # Fit and get X/Y coordinates
    coords = reducer.fit_transform(embeddings)

    # Attach the coordinates back to courses
    print("Attaching X and Y coordinates to course data...")
    for i, course in enumerate(courses):
        # Convert float32 from numpy to standard python float for JSON saving
        course['x'] = float(coords[i][0])
        course['y'] = float(coords[i][1])

    # Save the final mapped database
    print("Saving to database_mapped.json...")
    with open('database_mapped.json', 'w', encoding='utf-8') as f:
        json.dump(courses, f, indent=4, ensure_ascii=False)
        
    print("Courses now have spatial coordinates based on semantic meaning")

if __name__ == "__main__":
    generate_semantic_map()