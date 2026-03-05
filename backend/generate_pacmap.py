import json
import time
import numpy as np
import pacmap
import os

# Limit threads to prevent crash
os.environ["OMP_NUM_THREADS"] = "1"

def generate_pacmap_from_cache():
    print("Loading cached data...")
    try:
        # Load the courses
        with open('courses_cache.json', 'r', encoding='utf-8') as f:
            courses = json.load(f)
        # Load the pre-computed math (Instant!)
        embeddings = np.load('embeddings_cache.npy')
        print(f"Loaded {len(embeddings)} vectors from cache.")
    except FileNotFoundError:
        print("Error: Cache not found. Run 'generate_embeddings.py' first")
        return

    # PaCMAP
    print("Running PaCMAP...")
    # MN_ratio=0.5, FP_ratio=2.0 are standard for maintaining global structure
    reducer = pacmap.PaCMAP(n_components=2, n_neighbors=None, MN_ratio=0.5, FP_ratio=2.0) 
    
    start_time = time.time()
    coords = reducer.fit_transform(embeddings)
    print(f"PaCMAP finished in {round(time.time() - start_time, 2)} seconds.")

    # Attach coordinates
    print("Attaching coordinates...")
    for i, course in enumerate(courses):
        course['x'] = float(coords[i][0])
        course['y'] = float(coords[i][1])

    # Save final map
    output_file = 'database_mapped_pacmap.json'
    print(f"Saving to {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(courses, f, indent=4, ensure_ascii=False)
        
    print("Done")

if __name__ == "__main__":
    generate_pacmap_from_cache()