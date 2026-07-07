from flask import Flask, render_template, request, jsonify
from google import genai
from google.genai import types
import re
import socket
import os
from dotenv import load_dotenv
load_dotenv()

app = Flask(__name__,template_folder="app/templates")

# ---------------- CONFIG & SETUP ----------------
MODELS_TO_TRY = [
    "gemini-2.0-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash-latest"
]

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

try:
    client = genai.Client(api_key=GEMINI_API_KEY)
except Exception as e:
    print(f"Initialization Error: {e}")
    client = None

# ---------------- CORE LOGIC ----------------
def analyze_news(user_input):
    search_tool = types.Tool(google_search=types.GoogleSearch())

    prompt = f"""
    Verify this news claim: "{user_input}"
    1. Search for consensus across reliable news outlets such as BBC,Reuters,AP,NDTV, .gov or .edu domains
    2. Provide a 'Credibility Score' from 0 to 100.

    Format your response exactly:
    SCORE: [number]
    VERDICT: [Short title]
    ANALYSIS: [Detailed explanation]
    """

    for model_name in MODELS_TO_TRY:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    tools=[search_tool],
                    temperature=0.0
                )
            )
            return response
        except socket.gaierror:
            return {"error": "📡 Network Error: DNS lookup failed. Check your internet/VPN."}
        except Exception as e:
            if "429" in str(e):
                continue
            return {"error": f"Error with {model_name}: {e}"}
    return {"error": "All models exhausted. Please check quota/billing."}

def parse_response(text):
    score_match = re.search(r"SCORE:\s*(\d+)", text)
    score = int(score_match.group(1)) if score_match else 50
    clean_text = re.sub(r"SCORE:\s*\d+", "", text).replace("VERDICT:", "<h3>Verdict:</h3>").replace("ANALYSIS:", "<h3>Analysis:</h3>").strip()
    return score, clean_text

# ---------------- ROUTES ----------------
@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        claim = request.form.get("claim", "").strip()
        if not claim:
            return jsonify({"error": "Please enter a claim!"})

        raw_response = analyze_news(claim)
        if isinstance(raw_response, dict) and "error" in raw_response:
            return jsonify(raw_response)

        score, analysis = parse_response(raw_response.text)

        color = "green" if score >= 70 else "orange" if score >= 40 else "red"

        sources = []
        metadata = raw_response.candidates[0].grounding_metadata
        if metadata and metadata.grounding_chunks:
            for chunk in metadata.grounding_chunks:
                if chunk.web:
                    sources.append({"title": chunk.web.title, "uri": chunk.web.uri})

        return jsonify({

            "score": score,
            "analysis": analysis,
            "color": color,
            "sources": sources
        })

    return render_template("index.html")

if __name__ == "__main__":
    app.run(debug=True)