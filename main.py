"""Boss AI backend — Lenny's free-fusion AI app.

Free-tier only. Server keys come ONLY from Render env vars (never in code):
  GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY,
  CLOUDFLARE_API_TOKEN, TAVILY_API_KEY.
Optional env: LENNY_EMAIL (default lburaczewski0325@gmail.com),
GOOGLE_CLIENT_ID (default: Lenny's existing public Google OAuth client id).

Server-key endpoints (/api/chat, /api/image, /api/research) serve Lenny only:
the caller must present a Google ID token or access token that verifies (via
Google tokeninfo) as Lenny's account. Every other user chats with their OWN
free key straight from their device — their key never touches this server.
"""

import base64
import json
import os
import time

import requests
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ---------------------------------------------------------------- config
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
CLOUDFLARE_API_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN", "")
TAVILY_API_KEY = os.environ.get("TAVILY_API_KEY", "")
LENNY_EMAIL = os.environ.get("LENNY_EMAIL", "lburaczewski0325@gmail.com")
GOOGLE_CLIENT_ID = os.environ.get(
    "GOOGLE_CLIENT_ID",
    "129129791967-3iirp1823nh8tnivg3mghbjg3p6u5j9c.apps.googleusercontent.com",
)

GEMINI_MODEL = "gemini-2.0-flash"
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    + GEMINI_MODEL
    + ":generateContent"
)
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODELS = ["openai/gpt-oss-120b", "qwen/qwen3-32b"]
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODELS = [
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    "nvidia/nemotron-3.5-super-vl:free",
]
TAVILY_URL = "https://api.tavily.com/search"
CLOUDFLARE_ACCOUNTS_URL = "https://api.cloudflare.com/client/v4/accounts"
FLUX_MODELS = [
    "@cf/black-forest-labs/flux-1-schnell",
    "@cf/lykon/dreamshaper-8-lcm",
]
BACKEND_URL = "https://lenny-ai-ur2d.onrender.com"

SYSTEM_PROMPT = (
    "You are Boss AI, a straight-talking AI assistant. Explain things in plain, "
    "everyday language anyone can follow. Be detailed and accurate: give the full "
    "answer, with steps when the user asks how to do something. No fluff, no "
    "filler, no repeating the question back. If you are not sure about a fact, "
    "say so plainly instead of guessing."
)

# short-lived cache for verified Lenny tokens: token -> (email, expires_at)
_token_cache = {}
# cached Cloudflare account id
_cf_account_id = None


# ---------------------------------------------------------------- helpers
def _log(*parts):
    print("[boss-ai]", *parts, flush=True)


def _clean_messages(raw):
    """Keep only the last 20 messages, user/assistant roles, capped length."""
    if not isinstance(raw, list):
        return None
    out = []
    for m in raw[-20:]:
        if not isinstance(m, dict):
            continue
        role = m.get("role")
        content = m.get("content", "")
        if role not in ("user", "assistant"):
            continue
        if not isinstance(content, str):
            content = str(content)
        out.append({"role": role, "content": content[:8000]})
    return out or None


def _openai_shape_messages(messages, system=None):
    msgs = []
    if system:
        msgs.append({"role": "system", "content": system})
    msgs.extend(messages)
    return msgs


def _gemini_contents(messages):
    contents = []
    for m in messages:
        contents.append(
            {"role": "model" if m["role"] == "assistant" else "user",
             "parts": [{"text": m["content"]}]})
    return contents


def call_gemini(key, messages, system=SYSTEM_PROMPT, timeout=60):
    """One Gemini generateContent call. Returns reply text or raises."""
    body = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": _gemini_contents(messages),
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 2048},
    }
    r = requests.post(
        GEMINI_URL, params={"key": key}, json=body, timeout=timeout)
    if r.status_code != 200:
        raise RuntimeError("Gemini HTTP %s: %s" % (r.status_code, r.text[:300]))
    data = r.json()
    cands = data.get("candidates") or []
    if not cands:
        raise RuntimeError("Gemini returned no candidates: %s" % str(data)[:300])
    parts = (cands[0].get("content") or {}).get("parts") or []
    text = "".join(p.get("text", "") for p in parts).strip()
    if not text:
        reason = cands[0].get("finishReason", "?")
        raise RuntimeError("Gemini empty reply (finish: %s)" % reason)
    return text


def call_openai_compatible(url, key, model, messages, system=SYSTEM_PROMPT,
                           timeout=90, extra_headers=None):
    """One OpenAI-compatible chat completion. Returns reply text or raises."""
    headers = {"Authorization": "Bearer " + key,
               "Content-Type": "application/json"}
    if extra_headers:
        headers.update(extra_headers)
    body = {
        "model": model,
        "messages": _openai_shape_messages(messages, system),
        "temperature": 0.7,
        "max_tokens": 2048,
    }
    r = requests.post(url, headers=headers, json=body, timeout=timeout)
    if r.status_code != 200:
        raise RuntimeError("%s HTTP %s: %s" % (model, r.status_code, r.text[:300]))
    data = r.json()
    choices = data.get("choices") or []
    if not choices:
        raise RuntimeError("%s returned no choices" % model)
    msg = choices[0].get("message") or {}
    text = (msg.get("content") or "").strip()
    if not text:
        # reasoning models may put output elsewhere; surface what we got
        raise RuntimeError("%s empty reply" % model)
    return text


def chat_fallback_chain(messages):
    """Try Gemini -> Groq -> OpenRouter with the server keys.

    Returns (provider, model, reply, tried) where tried is a list of
    {provider, model, ok, error?} for the UI's resilience note.
    Raises ChainFailed (carrying .tried) if every provider failed.
    """
    tried = []
    # 1. Gemini
    if GEMINI_API_KEY:
        try:
            reply = call_gemini(GEMINI_API_KEY, messages)
            tried.append({"provider": "gemini", "model": GEMINI_MODEL, "ok": True})
            return "gemini", GEMINI_MODEL, reply, tried
        except Exception as e:  # noqa: BLE001 - fall through to next provider
            _log("gemini failed:", e)
            tried.append({"provider": "gemini", "model": GEMINI_MODEL,
                          "ok": False, "error": str(e)[:200]})
    else:
        tried.append({"provider": "gemini", "model": GEMINI_MODEL,
                      "ok": False, "error": "no server key configured"})
    # 2. Groq
    if GROQ_API_KEY:
        for model in GROQ_MODELS:
            try:
                reply = call_openai_compatible(GROQ_URL, GROQ_API_KEY, model, messages)
                tried.append({"provider": "groq", "model": model, "ok": True})
                return "groq", model, reply, tried
            except Exception as e:  # noqa: BLE001
                _log("groq %s failed:" % model, e)
                tried.append({"provider": "groq", "model": model,
                              "ok": False, "error": str(e)[:200]})
    else:
        tried.append({"provider": "groq", "model": GROQ_MODELS[0],
                      "ok": False, "error": "no server key configured"})
    # 3. OpenRouter (free Nemotron)
    if OPENROUTER_API_KEY:
        headers = {"HTTP-Referer": BACKEND_URL, "X-Title": "Boss AI"}
        for model in OPENROUTER_MODELS:
            try:
                reply = call_openai_compatible(
                    OPENROUTER_URL, OPENROUTER_API_KEY, model, messages,
                    extra_headers=headers)
                tried.append({"provider": "openrouter", "model": model, "ok": True})
                return "openrouter", model, reply, tried
            except Exception as e:  # noqa: BLE001
                _log("openrouter %s failed:" % model, e)
                tried.append({"provider": "openrouter", "model": model,
                              "ok": False, "error": str(e)[:200]})
    else:
        tried.append({"provider": "openrouter", "model": OPENROUTER_MODELS[0],
                      "ok": False, "error": "no server key configured"})
    raise ChainFailed("All chat providers failed", tried)


class ChainFailed(RuntimeError):
    def __init__(self, message, tried):
        super().__init__(message)
        self.tried = tried


def verify_lenny(id_token=None, access_token=None):
    """Verify a Google token belongs to Lenny. Returns email or None."""
    token = id_token or access_token
    if not token:
        return None
    now = time.time()
    cached = _token_cache.get(token)
    if cached and cached[1] > now:
        return cached[0]
    try:
        if id_token:
            r = requests.get("https://oauth2.googleapis.com/tokeninfo",
                             params={"id_token": id_token}, timeout=15)
        else:
            r = requests.get("https://oauth2.googleapis.com/tokeninfo",
                             params={"access_token": access_token}, timeout=15)
        if r.status_code != 200:
            _log("tokeninfo HTTP", r.status_code)
            return None
        info = r.json()
        email = info.get("email", "")
        aud = info.get("aud", "")
        exp = info.get("exp")
        if email.lower() != LENNY_EMAIL.lower():
            _log("token email is not Lenny:", email)
            return None
        if GOOGLE_CLIENT_ID and aud and aud != GOOGLE_CLIENT_ID:
            _log("token aud mismatch:", aud)
            return None
        if exp is not None and float(exp) <= now:
            return None
        expires_in = info.get("expires_in")
        ttl = int(expires_in) if expires_in else 3600
        _token_cache[token] = (email, now + min(ttl, 3600))
        return email
    except Exception as e:  # noqa: BLE001
        _log("token verify error:", e)
        return None


def _require_lenny():
    """Read tokens from the JSON body; return (email, error_response)."""
    data = request.get_json(silent=True) or {}
    email = verify_lenny(data.get("id_token"), data.get("access_token"))
    if not email:
        return None, (jsonify({
            "error": "lenny_only",
            "message": "This runs on Lenny's server keys. Sign in with Google "
                       "as Lenny to use it, or add your own free key in "
                       "Settings and chat with your own quota.",
        }), 403)
    return email, None


def _cloudflare_account_id():
    global _cf_account_id
    if _cf_account_id:
        return _cf_account_id
    r = requests.get(CLOUDFLARE_ACCOUNTS_URL,
                     headers={"Authorization": "Bearer " + CLOUDFLARE_API_TOKEN},
                     timeout=20)
    if r.status_code != 200:
        raise RuntimeError("Cloudflare accounts HTTP %s: %s"
                           % (r.status_code, r.text[:300]))
    accounts = (r.json().get("result") or [])
    if not accounts:
        raise RuntimeError("Cloudflare token sees no accounts")
    _cf_account_id = accounts[0]["id"]
    return _cf_account_id


# ---------------------------------------------------------------- routes
@app.route("/")
def index():
    return jsonify({"status": "ok", "service": "lenny-ai"})


@app.route("/health")
def health():
    return jsonify({"service": "lenny-ai", "status": "ok"})


@app.route("/api/status")
def api_status():
    return jsonify({
        "service": "lenny-ai",
        "status": "ok",
        "providers": {
            "gemini": bool(GEMINI_API_KEY),
            "groq": bool(GROQ_API_KEY),
            "openrouter": bool(OPENROUTER_API_KEY),
            "cloudflare": bool(CLOUDFLARE_API_TOKEN),
            "tavily": bool(TAVILY_API_KEY),
        },
        "google_client_id": GOOGLE_CLIENT_ID or None,
        "version": "1.0.0",
    })


@app.route("/api/config")
def api_config():
    return jsonify({"google_client_id": GOOGLE_CLIENT_ID or None})


@app.route("/api/chat", methods=["POST"])
def api_chat():
    email, err = _require_lenny()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    messages = _clean_messages(data.get("messages"))
    if not messages:
        return jsonify({"error": "no messages supplied"}), 400
    try:
        provider, model, reply, tried = chat_fallback_chain(messages)
    except ChainFailed as e:
        _log("chat chain failed for", email, ":", e)
        return jsonify({"error": "all_providers_failed",
                        "message": "Every chat provider failed right now. "
                                   "Try again in a minute.",
                        "tried": e.tried}), 502
    return jsonify({
        "provider": provider,
        "model": model,
        "reply": reply,
        "fallback": len([t for t in tried if not t["ok"]]) > 0,
        "tried": tried,
    })


@app.route("/api/image", methods=["POST"])
def api_image():
    email, err = _require_lenny()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    prompt = (data.get("prompt") or "").strip()
    if not prompt:
        return jsonify({"error": "no prompt supplied"}), 400
    if len(prompt) > 1000:
        prompt = prompt[:1000]
    if not CLOUDFLARE_API_TOKEN:
        return jsonify({"error": "image provider not configured"}), 502
    try:
        account_id = _cloudflare_account_id()
    except Exception as e:  # noqa: BLE001
        _log("cloudflare account lookup failed:", e)
        return jsonify({"error": "cloudflare_unavailable",
                        "message": "Could not reach Cloudflare: %s" % str(e)[:200]}), 502
    last_err = None
    for model in FLUX_MODELS:
        try:
            url = ("https://api.cloudflare.com/client/v4/accounts/%s/ai/run/%s"
                   % (account_id, model))
            r = requests.post(
                url,
                headers={"Authorization": "Bearer " + CLOUDFLARE_API_TOKEN},
                json={"prompt": prompt},
                timeout=120)
            if r.status_code != 200:
                raise RuntimeError("Cloudflare HTTP %s: %s"
                                   % (r.status_code, r.text[:300]))
            result = r.json().get("result") or {}
            b64 = result.get("image")
            if not b64:
                raise RuntimeError("Cloudflare returned no image")
            return jsonify({
                "model": model,
                "image": "data:image/png;base64," + b64,
            })
        except Exception as e:  # noqa: BLE001
            _log("image %s failed:" % model, e)
            last_err = e
    return jsonify({"error": "image_failed",
                    "message": "Image generation failed: %s" % str(last_err)[:200]}), 502


@app.route("/api/research", methods=["POST"])
def api_research():
    email, err = _require_lenny()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    query = (data.get("query") or "").strip()
    if not query:
        return jsonify({"error": "no query supplied"}), 400
    if len(query) > 500:
        query = query[:500]
    sources = []
    tavily_answer = ""
    tavily_ok = False
    if TAVILY_API_KEY:
        try:
            r = requests.post(TAVILY_URL, json={
                "api_key": TAVILY_API_KEY,
                "query": query,
                "search_depth": "advanced",
                "max_results": 5,
                "include_answer": True,
            }, timeout=45)
            if r.status_code == 200:
                tdata = r.json()
                for item in tdata.get("results") or []:
                    sources.append({"title": item.get("title", ""),
                                    "url": item.get("url", "")})
                tavily_answer = (tdata.get("answer") or "").strip()
                tavily_ok = True
            else:
                _log("tavily HTTP", r.status_code, r.text[:200])
        except Exception as e:  # noqa: BLE001
            _log("tavily failed:", e)
    # Summarize with Gemini (server key) using the live sources as context.
    context = ""
    if sources:
        context = "\n\nLive sources:\n" + "\n".join(
            "- %s (%s)" % (s["title"], s["url"]) for s in sources)
    prompt = ("Research this question and answer it in plain, detailed language. "
              "Use the live sources below when they help, and say which source "
              "each key fact came from. If the sources do not cover it, say so.\n\n"
              "Question: %s%s" % (query, context))
    if tavily_answer:
        prompt += "\n\nTavily's own short answer (check it against the sources): %s" % tavily_answer
    try:
        if not GEMINI_API_KEY:
            raise RuntimeError("no Gemini server key")
        answer = call_gemini(GEMINI_API_KEY,
                             [{"role": "user", "content": prompt}],
                             system=SYSTEM_PROMPT, timeout=60)
        return jsonify({"answer": answer, "sources": sources,
                        "live": tavily_ok, "provider": "gemini+tavily"})
    except Exception as e:  # noqa: BLE001
        _log("research gemini failed:", e)
        if tavily_answer:
            return jsonify({"answer": tavily_answer, "sources": sources,
                            "live": tavily_ok, "provider": "tavily"})
        return jsonify({"error": "research_failed",
                        "message": "Research failed: %s" % str(e)[:200]}), 502


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
