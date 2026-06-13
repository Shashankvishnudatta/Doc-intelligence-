from dotenv import load_dotenv
import os
import time

from huggingface_hub import InferenceClient

load_dotenv()

hf_token = os.getenv("HF_TOKEN")
preferred_model = os.getenv("HF_MODEL", "").strip()

if not hf_token:
    raise RuntimeError("HF_TOKEN is missing from .env")

candidate_models = []

if preferred_model:
    candidate_models.append(preferred_model)

candidate_models.extend(
    [
        "meta-llama/Llama-3.1-8B-Instruct:fastest",
        "mistralai/Mistral-7B-Instruct-v0.3:fastest",
        "Qwen/Qwen2.5-7B-Instruct:fastest",
        "openai/gpt-oss-20b:fastest",
        "openai/gpt-oss-120b:fastest",
        "deepseek-ai/DeepSeek-R1:fastest",
    ]
)

# Remove duplicates while preserving order.
candidate_models = list(dict.fromkeys(candidate_models))

print("HF token loaded:", hf_token[:8] + "...")
print("Testing candidate models...")

client = InferenceClient(
    api_key=hf_token,
    timeout=15,
)

last_error = None
working_models = []

for model in candidate_models:
    print("\nTrying model:", model)
    start_time = time.perf_counter()

    try:
        completion = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": "You are a concise assistant. Reply with plain text only.",
                },
                {
                    "role": "user",
                    "content": "Reply with only this word: OK",
                },
            ],
            temperature=0.1,
            max_tokens=30,
        )

        elapsed = time.perf_counter() - start_time

        content = completion.choices[0].message.content

        if content is None:
            print(f"Failed: returned None content in {elapsed:.2f}s")
            continue

        answer = str(content).strip()

        if not answer:
            print(f"Failed: returned empty content in {elapsed:.2f}s")
            continue

        print("HF response:", answer)
        print(f"Time: {elapsed:.2f}s")
        print("WORKING_MODEL=" + model)

        working_models.append((elapsed, model, answer))

    except Exception as exc:
        elapsed = time.perf_counter() - start_time
        last_error = exc
        print(f"Failed in {elapsed:.2f}s:", str(exc)[:500])

print("\nSummary:")

if working_models:
    working_models.sort(key=lambda item: item[0])
    fastest = working_models[0]

    print(f"FASTEST_WORKING_MODEL={fastest[1]}")
    print(f"FASTEST_TIME={fastest[0]:.2f}s")
else:
    print("No candidate model returned valid text.")
    print("Last error:")
    print(last_error)