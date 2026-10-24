"""Offline regression checks for audio caching and catalog exclusion."""
import asyncio
import importlib.util
import json
import sys
import tempfile
import types
from pathlib import Path

calls = []
class Voice:
    def __init__(self, text, voice, rate):
        self.text = text
    async def save(self, path):
        calls.append(self.text)
        Path(path).write_bytes(b'mp3-test')

sys.modules['edge_tts'] = types.SimpleNamespace(Communicate=Voice)
spec = importlib.util.spec_from_file_location('audio', Path(__file__).resolve().parents[1] / 'scripts/gen_audio.py')
audio = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audio)

async def check():
    with tempfile.TemporaryDirectory() as folder:
        audio.OUT = Path(folder)
        target = audio.OUT / 'word.mp3'
        target.write_bytes(b'old-audio')
        await audio.say('你好', target)  # old cache without fingerprint must be replaced
        await audio.say('你好', target)  # unchanged audio reused
        await audio.say('再见', target)  # changed text replaced
        audio.RATE = '-10%'
        await audio.say('再见', target)  # changed voice settings replaced
        assert calls == ['你好', '再见', '再见'], calls
        calls.clear()
        await audio.main()
        expected = []
        total_words = 0
        for deck_path in sorted((audio.ROOT/'decks').glob('lesson*.json')):
            words = json.loads(deck_path.read_text())['words']
            total_words += len(words)
            for w in words:
                expected.extend([w.get('audioText', w['hanzi']), w['sentence'].replace('___', w['hanzi'])])
                assert (audio.OUT/'audio'/deck_path.stem/f"{w['id']}.mp3").exists()
                assert (audio.OUT/'audio'/deck_path.stem/f"{w['id']}_s.mp3").exists()
        assert calls == expected
        assert len(calls) == total_words * 2
        assert not (audio.OUT/'audio/catalog').exists()
        assert '___' not in ''.join(calls)
        print(f'PASS: {len(calls)} audio outputs, catalog exclusion, pronunciation contexts, and text/voice cache invalidation.')

asyncio.run(check())
