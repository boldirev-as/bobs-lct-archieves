import os, json, time, uuid, requests
from datetime import datetime, timezone
from pydantic import BaseModel, Field, ValidationError, conlist

# -------- Конфиг --------
YANDEX_IAM_TOKEN = os.getenv("YC_IAM_TOKEN")
CATALOG_ID = os.getenv("YC_CATALOG_ID")
MODEL_URI = f"gpt://{CATALOG_ID}/yandexgpt"
API_URL = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"


# -------- Схемы --------
class Entity(BaseModel):
    id: str
    blockIndex: int
    text: str
    startIndex: int
    endIndex: int
    type: str = Field("ФИО", const=True)
    createdAt: str


class EntitiesPayload(BaseModel):
    entities: conlist(Entity, min_items=0)


# -------- Утилиты --------
def iso_now_utc_ms():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def make_id():
    return f"entity_{int(time.time() * 1000)}_{uuid.uuid4().hex[:6]}"


SYSTEM_PROMPT = (
    "Задача: из входного текста извлечь все упоминания ФИО (персоны) на русском.\n"
    "Разбей текст на блоки по последовательности из двух переводов строки (\\n\\n) в исходном тексте, сохрани порядок.\n"
    "Для каждого найденного ФИО верни объект со свойствами:\n"
    " - blockIndex (int): индекс блока, начиная с 0;\n"
    " - text (string): точный подстрочный фрагмент ФИО из блока;\n"
    " - startIndex (int): начальный символ внутри БЛОКА;\n"
    " - endIndex (int): конечный символ (исключительно) внутри БЛОКА.\n"
    "Требования:\n"
    " - Учитывай дефисы, отчества, женские/мужские формы, инициалы.\n"
    " - Не включай должности/звания/пунктуацию, только само ФИО.\n"
    " - Возвращай СТРОГО JSON следующего вида без пояснений: {\"entities\": [ ... ]}\n"
)


def call_yandex(full_text: str, temperature: float = 0.0, max_tokens: int = 2000) -> dict:
    payload = {
        "modelUri": MODEL_URI,
        "completionOptions": {"stream": False, "temperature": temperature, "maxTokens": str(max_tokens)},
        "messages": [
            {"role": "system", "text": SYSTEM_PROMPT},
            {"role": "user", "text": full_text}
        ]
    }
    headers = {"Authorization": f"Bearer {YANDEX_IAM_TOKEN}"}
    r = requests.post(API_URL, headers=headers, json=payload, timeout=60)
    r.raise_for_status()
    data = r.json()
    text = data["result"]["alternatives"][0]["message"]["text"]

    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")

        i = text.find("{")
        text = text[i:] if i >= 0 else text
    return json.loads(text)


def build_entities(full_text: str) -> dict:
    created_at = iso_now_utc_ms()

    raw = call_yandex(full_text)

    try:

        for e in raw.get("entities", []):
            e.setdefault("id", make_id())
            e.setdefault("type", "ФИО")
            e.setdefault("createdAt", created_at)

        payload = EntitiesPayload(**raw)
    except ValidationError:

        entities = []
        for item in raw.get("entities", []):
            try:
                ent = {
                    "id": item.get("id") or make_id(),
                    "blockIndex": int(item["blockIndex"]),
                    "text": str(item["text"]),
                    "startIndex": int(item["startIndex"]),
                    "endIndex": int(item["endIndex"]),
                    "type": "ФИО",
                    "createdAt": created_at,
                }
                entities.append(Entity(**ent))
            except Exception:
                continue
        payload = EntitiesPayload(entities=entities)

    blocks = full_text.split("\n\n")
    cleaned = []
    for e in payload.entities:
        if 0 <= e.blockIndex < len(blocks):
            block = blocks[e.blockIndex]
            if 0 <= e.startIndex <= e.endIndex <= len(block):

                if block[e.startIndex:e.endIndex] == e.text:
                    cleaned.append(e)
                else:
                    e.text = block[e.startIndex:e.endIndex]
                    cleaned.append(e)
    result = {"entities": [e.model_dump() for e in cleaned]}
    return result


# ----- Пример запуска -----
if __name__ == "__main__":
    full_text = """Уважаемый коллега!

Вчера на совещании присутствовали Иванов Иван Иванович и Петрова Мария Сергеевна.
Также отметился Сидоров-Петров Николай Андреевич.

С уважением,
Команда."""
    print(json.dumps(build_entities(full_text), ensure_ascii=False, indent=2))
