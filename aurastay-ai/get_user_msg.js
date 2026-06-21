const fs = require('fs');
const logPath = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\78d29bd6-fd0a-4e11-b312-73a79109cadc\\.system_generated\\logs\\transcript.jsonl';
const outputPath = 'C:\\Users\\user\\.gemini\\antigravity\\scratch\\aurastay-ai\\last_user_message_full.txt';

try {
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n');
  let lastContent = '';
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i]) continue;
    try {
      const data = JSON.parse(lines[i]);
      if (data.type === 'USER_INPUT') {
        lastContent = data.content;
        break;
      }
    } catch (e) {}
  }
  fs.writeFileSync(outputPath, lastContent, 'utf8');
  console.log('SUCCESS');
} catch (err) {
  console.error(err);
}
