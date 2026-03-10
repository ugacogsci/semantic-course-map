## UGA Semantic Course Map

An exploratory, AI-powered spatial visualization of the University of Georgia course catalog.

Built by the Cognitive Science Club for The Generative AI Competition 3.0.

[Go to Project](https://ugacogsci.github.io/semantic-course-map/)

### Project Overview
Navigating a university course catalog is typically a highly functional process, but we believe it can be a deeply exploratory and intellectually interesting one. Our goal was to enrich the UGA academic experience by transforming the static Schedule of Classes into an interactive Semantic Course Map. By leveraging Generative AI, vector embedding, and Retrieval-Augmented Generation (RAG), we mapped over 14,000 UGA courses onto a 2D visual canvas. Courses covering semantically similar material naturally cluster together, allowing students to organically explore the curriculum, discover unexpected academic pathways, and visualize the macro-structure of the university.
- Semantic Spatial Mapping: We generated AI embeddings for 14,092 courses using HuggingFace's all-MiniLM-L6-v2 and projected them into 2D space.
- Comparative Manifold Explorer: Users can instantly toggle between multiple dimensionality reduction algorithms (UMAP, PaCMAP, TriMAP, and t-SNE) to view the data's local and global structures from different mathematical perspectives.
- Targeted Semantic Search: An optimized search engine that dynamically highlights matching text across course descriptions, objectives, and outlines.
- Orion - The AI Course Assistant: A built-in RAG chatbot powered by Claude 4.5 Haiku. Users can ask complex queries (e.g., "What courses combine psychology and AI?"), and the bot retrieves the most semantically relevant courses to synthesize a personalized response.
- High-Performance UI: Capable of rendering 14,000+ interactive nodes using Cytoscape.js.

This repository uses specific branching for development and deployment.  

    - main (Current Branch): Contains the complete, uncompiled source code. This is where you will find our Python AI pipeline (backend/) and our React application (frontend/).

    - gh-pages: Contains the compressed, minified build and static JSON database files. This branch is strictly used by GitHub Actions for serverless deployment and has a compiled file structure.

    (Other working branches can be safely ignored).

### The Pipeline
Ingestion: Reverse-engineered the UGA Bulletin's internal API to scrape 14,092 courses.

Enrichment: Scraped HTML data for each specific course to retrieve detailed "Course Objectives" and "Topical Outlines."

Embedding: Concatenated textual features and processed them through an embedding model (SentenceTransformer) to generate 384-dimensional semantic vectors.

Projection: Reduced dimensions to X/Y coordinates using UMAP, PaCMAP, TriMAP, and t-SNE.

Hosting: Deployed entirely serverless. The data was pre-computed into static .json files (frontend/public/data).


### Local Setup & Installation

Frontend:
If you wish to run the development environment locally from the main branch:

    cd frontend
    npm install
    npm run dev

Backend:
If you wish to re-run the web scrapers or re-calculate the UMAP/t-SNE/etc. coordinates:

    cd backend
    conda env create -f environment.yml
    conda activate uga-ai

    # Run the embedding engine
    python generate_embeddings.py
    
    # Run the dimensionality reduction scripts
    python generate_map_umap.py
    python generate_map_tsne.py
    # etc.

### Using the Chatbot

The Anthropic API key is not hardcoded into the repository.
To use the "Orion" RAG Course Assistant:
- Click the Chatbot icon (✦) in the bottom right corner of the application.
- Click the Settings icon (⚙️) in the Chatbot header.
- Paste a valid Anthropic API Key. You can use this one (**get rid of ampersands before pasting**):

  sk-ant-api03-P8JaI&&&&&L7sAybfxwej1j5x&&&&&YBzJNVlMsV1Z-KYAt9jIOR&&&&&V0_GFgWiOXYtVyXiVk3x&&&&&wOMzkRC2dsDZroe0Akj&&&&&lbHog-lyK_KwAA
- The key is held strictly in your browser's local memory and is never saved to a database.

<br>

### Tech Stack

Frontend: React.js, Vite, Cytoscape.js

AI/ML Pipeline: Python 3.10, PyTorch, HuggingFace (sentence-transformers), UMAP, PaCMAP, TriMAP, Scikit-Learn

LLM Engine: Anthropic Claude 4.5 Haiku API

Data Scraping: BeautifulSoup4, Requests

DevOps: Conda, GitHub Pages

<br>
<br>

*Built over a 7-day sprint for the UGA community.*
