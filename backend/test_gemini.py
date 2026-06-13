from dotenv import load_dotenv
import os

from google import genai
from google.genai import types

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise RuntimeError("GEMINI_API_KEY is missing from .env")

print("Gemini key loaded:", api_key[:8] + "...")

client = genai.Client(api_key=api_key)

response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents="Reply with only this word: OK",
    config=types.GenerateContentConfig(
        temperature=0.1,
    ),
)

print("Gemini response:")
print(response.text)