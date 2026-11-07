
from flask import Flask, render_template, request, jsonify
from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient

app = Flask(__name__)

ENDPOINT = "https://rio-claro-ai-resource.services.ai.azure.com/api/projects/rio-claro-ai"
AGENT_NAME = "rio-claro-ia-v2"


@app.route("/")
def inicio():
    return render_template("index.html")


@app.route("/chat", methods=["POST"])
def chat():
    datos = request.get_json(silent=True) or {}
    pregunta = str(datos.get("mensaje", "")).strip()
    historial_recibido = datos.get("historial", [])

    if not pregunta:
        return jsonify({"error": "Escribe una pregunta."}), 400

    historial = []

    if isinstance(historial_recibido, list):
        for mensaje in historial_recibido[-20:]:
            if not isinstance(mensaje, dict):
                continue

            rol = mensaje.get("role")
            contenido = str(mensaje.get("content", "")).strip()

            if rol in ("user", "assistant") and contenido:
                historial.append({
                    "role": rol,
                    "content": contenido
                })

    if (
        not historial
        or historial[-1].get("role") != "user"
        or historial[-1].get("content") != pregunta
    ):
        historial.append({
            "role": "user",
            "content": pregunta
        })

    try:
        with (
            DefaultAzureCredential() as credencial,
            AIProjectClient(
                endpoint=ENDPOINT,
                credential=credencial,
                allow_preview=True
            ) as proyecto
        ):
            cliente = proyecto.get_openai_client(agent_name=AGENT_NAME)
            conversacion = cliente.conversations.create()

            respuesta = cliente.responses.create(
                conversation=conversacion.id,
                input=historial
            )

            return jsonify({
                "respuesta": respuesta.output_text or "No se obtuvo una respuesta."
            })

    except Exception:
        app.logger.exception("Error al consultar Microsoft Foundry")
        return jsonify({
            "error": "No fue posible consultar el asistente. Intenta nuevamente."
        }), 502


if __name__ == "__main__":
    app.run(debug=True)
