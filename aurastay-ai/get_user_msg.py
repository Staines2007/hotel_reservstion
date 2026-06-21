import json
import os

log_path = r'C:\Users\user\.gemini\antigravity\brain\78d29bd6-fd0a-4e11-b312-73a79109cadc\.system_generated\logs\transcript.jsonl'
output_path = r'C:\Users\user\.gemini\antigravity\scratch\aurastay-ai\last_user_message_full.txt'

last_content = ""
if os.path.exists(log_path):
    with open(log_path, 'r', encoding='utf-8') as f:
        for line in f:
            try:
                data = json.loads(line)
                if data.get('type') == 'USER_INPUT':
                    last_content = data.get('content')
            except Exception as e:
                pass

with open(output_path, 'w', encoding='utf-8') as outf:
    outf.write(last_content)

print("SUCCESS")
