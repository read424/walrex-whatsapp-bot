import json
import sqlite3 # Usaremos SQLite para simular la BD local
import requests
import time

# --- 1. Funciones que simulan la consulta a la Base de Datos (Tus Herramientas) ---

def get_exchange_rate(country_code: str):
    """Obtiene la tasa de cambio USD a moneda local desde la BD."""
    
    # --- Aquí iría tu código de conexión a la BD real (Postgres, MySQL, etc.) ---
    
    # SIMULACIÓN DE CONSULTA SQL
    rates = {
        "MXN": 18.50,
        "COP": 3850.25,
        "PEN": 3.75,
        "CLP": 910.80
    }
    
    country_code = country_code.upper()

    if country_code in rates:
        # Devuelve el resultado del query como una cadena que el modelo puede leer
        return f"La tasa de cambio actual de USD a {country_code} es: {rates[country_code]}"
    else:
        return f"No se encontró una tasa para el país con código {country_code}."

def get_available_countries():
    """Obtiene la lista de países disponibles desde la BD."""
    # SIMULACIÓN DE CONSULTA SQL
    countries = ["México (MXN)", "Colombia (COP)", "Perú (PEN)", "Chile (CLP)"]
    return "Los países disponibles son: " + ", ".join(countries)

# Mapeo de nombres de herramientas a funciones de Python
TOOL_FUNCTIONS = {
    "get_exchange_rate": get_exchange_rate,
    "get_available_countries": get_available_countries
}

# --- 2. Lógica de Interacción con Ollama ---

OLLAMA_URL = "http://localhost:11434/api/generate"

def run_agent(model_name: str, prompt: str):
    """Ejecuta la lógica del agente con Ollama, manejando Tool Calling."""
    
    print(f"-> Usuario: {prompt}")
    
    # Primer pase: Petición inicial a Ollama
    payload = {
        "model": model_name,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.1},
    }
    
    try:
        response = requests.post(OLLAMA_URL, json=payload, timeout=900)
        response.raise_for_status()
        
        data = response.json()
        
        # 3. Detectar si el modelo solicitó una herramienta (Tool Calling)
        if "tool_call" in data:
            tool_call = data["tool_call"]
            tool_name = tool_call["name"]
            tool_args = tool_call["args"]

            print(f"-> Agente: Ejecutando herramienta '{tool_name}' con argumentos: {tool_args}")
            
            if tool_name in TOOL_FUNCTIONS:
                # 4. Ejecutar la función Python (Consulta a la BD)
                tool_output = TOOL_FUNCTIONS[tool_name](**tool_args)
                print(f"-> Herramienta: Resultado del query: {tool_output}")
                
                # 5. Segundo pase: Enviar el resultado del query a Ollama
                # La IA usa el output para generar la respuesta final.
                
                # Usar el formato de mensaje para el segundo pase
                messages = [
                    {"role": "system", "content": data["system"]}, # Reutiliza el system prompt
                    {"role": "user", "content": prompt},
                    {"role": "tool_call", "content": json.dumps(tool_call)}, # Indica la llamada
                    {"role": "tool_response", "content": tool_output} # Muestra el resultado
                ]

                second_payload = {
                    "model": model_name,
                    "messages": messages, # Usamos el array de mensajes en lugar de solo 'prompt'
                    "stream": False,
                    "options": {"temperature": 0.1}
                }

                second_response = requests.post(OLLAMA_URL, json=second_payload, timeout=900)
                second_response.raise_for_status()
                final_data = second_response.json()
                
                # 6. Respuesta final
                return final_data.get("response", "Lo siento, no pude obtener la respuesta final.")

            else:
                return f"Error: Herramienta desconocida solicitada: {tool_name}"
        
        # Si no hay tool_call, devuelve la respuesta directa (Para preguntas simples)
        return data.get("response", "Ollama no respondió.")

    except requests.exceptions.RequestException as e:
        return f"Error de conexión con Ollama: {e}"
    except Exception as e:
        return f"Ocurrió un error inesperado: {e}"

# --- 3. Ejecución de Prueba ---
if __name__ == "__main__":
    MODEL_NAME = "remesa-bot" # Asegúrate de haber creado este modelo antes!
    
    # 1. Prueba de consulta de tasa (DEBE ejecutar la herramienta)
    prompt_rate = "¿Cuál es el tipo de cambio de hoy para mandar 100 dólares a Colombia?"
    print("\n--- TEST 1: Consulta de Tasa ---")
    final_answer = run_agent(MODEL_NAME, prompt_rate)
    print(f"\nRespuesta final del Bot:\n{final_answer}")

    # 2. Prueba de consulta de países (DEBE ejecutar la herramienta)
    prompt_countries = "¿Me puedes listar los países disponibles?"
    print("\n--- TEST 2: Consulta de Países ---")
    final_answer_countries = run_agent(MODEL_NAME, prompt_countries)
    print(f"\nRespuesta final del Bot:\n{final_answer_countries}")