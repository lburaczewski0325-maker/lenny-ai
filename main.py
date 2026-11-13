from flask import Flask, jsonify
app = Flask(__name__)
@app.route("/")
def health():
    return jsonify({"status": "ok", "service": "lenny-ai"})
@app.route("/health")
def health2():
    return jsonify({"status": "ok", "service": "lenny-ai"})
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
