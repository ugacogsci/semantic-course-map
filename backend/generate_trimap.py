import json
import time
import numpy as np
import trimap
import os
from sklearn.preprocessing import MinMaxScaler

# Limit threads to prevent any multiprocessing clashes
os.environ["OMP_NUM_THREADS"] = "1"

def generate_trimap_from_cache():
    print("Loading cached data...")
    try:
        with open('courses_cache.json', 'r', encoding='utf-8') as f:
            courses = json.load(f)
        
        # Load embeddings
        raw_embeddings = np.load('embeddings_cache.npy')
        
        # Force data to float32 and make it contiguous (Fixes "shape (0,)" error)
        embeddings = np.ascontiguousarray(raw_embeddings.astype(np.float32))
        
        print(f"Loaded {len(embeddings)} vectors from cache.")
    except FileNotFoundError:
        print("Error: Cache not found. Run 'generate_embeddings.py' first")
        return

    # TriMAP ---
    print("Running TriMAP...")
    
    # We use distance='angular' because semantic vectors operate on Cosine Similarity
    reducer = trimap.TRIMAP(
        n_inliers=50, # default 12
        n_outliers=20, # default 4
        n_random=50, # default 3
        distance='angular'
    )
    
    start_time = time.time()
    
    # Fit and get raw X/Y coordinates
    raw_coords = reducer.fit_transform(embeddings)
    
    print(f"TriMAP finished in {round(time.time() - start_time, 2)} seconds.")

    # [CHANGE: NORMALIZATION] 
    # TriMAP outputs very large coordinates. We normalize them to [-10, 10]
    # to match the scale of UMAP/PaCMAP for the frontend.
    print("Normalizing coordinates to range [-10, 10]...")
    scaler = MinMaxScaler(feature_range=(-10, 10))
    coords = scaler.fit_transform(raw_coords)

    # Attach coordinates
    print("Attaching coordinates...")
    for i, course in enumerate(courses):
        course['x'] = float(coords[i][0])
        course['y'] = float(coords[i][1])

    # Save final map
    output_file = 'database_mapped_trimap.json'
    print(f"Saving to {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(courses, f, indent=4, ensure_ascii=False)
        
    print("TriMAP generation complete")

if __name__ == "__main__":
    generate_trimap_from_cache()