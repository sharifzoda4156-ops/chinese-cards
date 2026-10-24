"""Генерирует mp3-озвучку для всех колод в decks/*.json.

Для каждого слова создаются два файла:
  audio/<колода>/<id>.mp3    — само слово
  audio/<колода>/<id>_s.mp3  — предложение-пример целиком

Озвучка повторно используется только при совпадении текста, голоса и скорости.

Запуск:  pip install edge-tts  &&  python scripts/gen_audio.py [папка_вывода]
"""
import asyncio
import hashlib
import json
import sys
from pathlib import Path

import edge_tts

VOICE = "zh-CN-XiaoxiaoNeural"  # женский голос; мужской: zh-CN-YunxiNeural
RATE = "-15%"                    # чуть медленнее для учеников

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT


async def say(text: str, path: Path) -> None:
    fingerprint = hashlib.sha256(f"{VOICE}\n{RATE}\n{text}".encode()).hexdigest()
    stamp = path.with_suffix(".sha256")
    if (path.exists() and path.stat().st_size > 0 and stamp.exists()
            and stamp.read_text(encoding="utf-8") == fingerprint):
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(3):
        try:
            await edge_tts.Communicate(text, VOICE, rate=RATE).save(str(path))
            stamp.write_text(fingerprint, encoding="utf-8")
            print("ok  ", path.relative_to(OUT), text)
            return
        except Exception as e:  # сеть иногда моргает
            print("retry", attempt + 1, path.name, e)
            await asyncio.sleep(2)
    raise RuntimeError(f"не удалось озвучить: {text}")


async def main() -> None:
    for deck_file in sorted((ROOT / "decks").glob("*.json")):
        if deck_file.name == "catalog.json":
            continue
        deck = json.loads(deck_file.read_text(encoding="utf-8"))
        folder = OUT / "audio" / deck_file.stem
        for w in deck["words"]:
            await say(w.get("audioText", w["hanzi"]), folder / f"{w['id']}.mp3")
            sentence = w["sentence"].replace("___", w["hanzi"])
            await say(sentence, folder / f"{w['id']}_s.mp3")


if __name__ == "__main__":
    asyncio.run(main())

