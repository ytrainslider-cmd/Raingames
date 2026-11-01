BLUE ARCADE
1. Install Node.js 18+ (nodejs.org)
2. In this folder run:  node server.js     (optional: npm install  for real emails)
3. Open http://localhost:3000

EMAIL CODES: set these environment variables to send real emails (then run npm install):
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
Without them, the verification code is printed in the terminal window.

AI GAMES: set ANTHROPIC_API_KEY to let Claude build real custom games.
Without it, the AI option builds a game from simple keywords (catch/colors).
