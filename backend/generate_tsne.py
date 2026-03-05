import json
import time
import numpy as np
from sklearn.manifold import TSNE 
from sklearn.preprocessing import MinMaxScaler
import os

# Limit threads to prevent crash
os.environ["OMP_NUM_THREADS"] = "1"

def generate_tsne_from_cache():
    print("Loading cached data...")
    try:
        with open('courses_cache.json', 'r', encoding='utf-8') as f:
            courses = json.load(f)
        embeddings = np.load('embeddings_cache.npy')
        print(f"Loaded {len(embeddings)} vectors from cache.")
    except FileNotFoundError:
        print("Error: Cache not found. Run 'generate_embeddings.py' first")
        return

    # t-SNE
    print("Running t-SNE (t-Distributed Stochastic Neighbor Embedding)...")
    # metric='cosine' is best for text embeddings
    # init='pca' helps t-SNE converge faster and creates a more stable global layout
    # higher perplexity accounts for longer range relationships, default is 30
    reducer = TSNE(n_components=2, metric='cosine', init='pca', learning_rate='auto', random_state=42, n_jobs=-1, perplexity=1000)
    
    start_time = time.time()
    raw_coords = reducer.fit_transform(embeddings)
    print(f"t-SNE finished in {round(time.time() - start_time, 2)} seconds.")

    # [CHANGE: NORMALIZATION]
    # t-SNE often outputs large clusters. We normalize to [-10, 10] to ensure
    # consistency with the frontend zoom levels.
    print("Normalizing coordinates to range [-10, 10]...")
    scaler = MinMaxScaler(feature_range=(-10, 10))
    coords = scaler.fit_transform(raw_coords)

    # Attach coordinates
    print("Attaching coordinates...")
    for i, course in enumerate(courses):
        course['x'] = float(coords[i][0])
        course['y'] = float(coords[i][1])

    # Save final map
    output_file = 'database_mapped_tsne.json'
    print(f"Saving to {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(courses, f, indent=4, ensure_ascii=False)
        
    print("t-SNE generation complete")

if __name__ == "__main__":
    generate_tsne_from_cache()