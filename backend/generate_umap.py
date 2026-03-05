import json
import time
import umap
import numpy as np
import os

# Limit threads to prevent crash
os.environ["OMP_NUM_THREADS"] = "1"

def generate_semantic_map_from_cache():
    print("Loading cached data...")
    try:
        # Load the courses from the cache to ensure alignment
        with open('courses_cache.json', 'r', encoding='utf-8') as f:
            courses = json.load(f)
        
        # Load the pre-computed math (Instant!)
        embeddings = np.load('embeddings_cache.npy')
        print(f"Loaded {len(embeddings)} vectors from cache.")
    except FileNotFoundError:
        print("Error: Cache not found. Run 'generate_embeddings.py' first")
        return

    # UMAP Dimensionality Reduction (384 Dimensions -> 2 Dimensions)
    print("Running UMAP...")
    # n_neighbors controls how local/global the clusters are, default 15
    # min_dist controls how tightly packed the nodes are. 0.1 makes distinct clusters.
    reducer = umap.UMAP(n_neighbors=100, min_dist=0.1, metric='cosine', random_state=42)
    
    start_time = time.time()
    # Fit and get X/Y coordinates
    coords = reducer.fit_transform(embeddings)
    print(f"UMAP finished in {round(time.time() - start_time, 2)} seconds.")

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
    generate_semantic_map_from_cache()