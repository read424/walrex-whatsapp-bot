import ollama
import psycopg2

texto = "La inteligencia artificial esta tranformando la programación"

response = ollama.embeddings(model="mxbai-embed-large", prompt=texto)

embedding = response["embedding"]

print(f"Longitud del embedding: {len(embedding)}")

conn = psycopg2.connect(
    dbname="walrex_db",
    user="postgres",
    password="12345",
    host="localhost",
    port="5432"
)

cur = conn.cursor()

cur.execute(
    "INSERT INTO embeddings (texto, embedding) VALUES (%s, %s)",
    (texto, embedding)
)

conn.commit()
cur.close()
conn.close()
