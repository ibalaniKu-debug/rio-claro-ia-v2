# Before running the sample:
#    pip install "azure-ai-projects>=2.1.0"

from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient

endpoint = "https://rio-claro-ai-resource.services.ai.azure.com/api/projects/rio-claro-ai"
agent_name = "rio-claro-ia-v2"
user_message = "Según los documentos de Distribuidora Río Claro, ¿qué información contiene la factura RC-1001?"

with (
    DefaultAzureCredential() as credential,
    AIProjectClient(
        endpoint=endpoint,
        credential=credential,
        allow_preview=True,
    ) as project_client,
):
    # Bind the OpenAI client to the existing agent endpoint.
    openai_client = project_client.get_openai_client(agent_name=agent_name)

    # GitHub Copilot preview agents require a conversation for every Responses turn.
    conversation = openai_client.conversations.create()
    response = openai_client.responses.create(
        conversation=conversation.id,
        input=[{"role": "user", "content": user_message}],
    )

    print(f"Response output: {response.output_text}")