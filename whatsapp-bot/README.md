# WhatsApp chatbot (Meta Cloud API)

A small Node.js webhook Shyam Prasad can run so **WhatsApp on his personal phone** talks to a friendly bot. It verifies Meta’s hub challenge, receives inbound messages, and sends text replies through the [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/).

Starter skills: **hello**, **help**, **ping**. Add more in [`src/bot.js`](src/bot.js) when the real use case is known.

## What you need

- Node.js 18+
- A [Meta Developer](https://developers.facebook.com/) account (Facebook login)
- WhatsApp already installed on your phone
- A public HTTPS URL for the webhook (ngrok, Cloudflare Tunnel, or similar)

You do **not** need a paid WhatsApp Business number to try this. Meta gives every app a **test number**. Your personal phone must be added as an allowed recipient.

---

## 1. Create a Meta Developer app

1. Open [developers.facebook.com](https://developers.facebook.com/) and sign in.
2. **My Apps → Create App**.
3. Choose a use case that includes WhatsApp (or **Other** → **Business**).
4. Name it something like `Kiteline WhatsApp` and create the app.

## 2. Add the WhatsApp product

1. In the app dashboard, **Add product** → **WhatsApp** → **Set up**.
2. Open **WhatsApp → API Setup** (sometimes labelled **Getting started**).
3. Copy these values into `.env` (see step 4):

   | Meta label | `.env` variable |
   |---|---|
   | **Phone number ID** (under the test number — digits, not `+1 555…`) | `WHATSAPP_PHONE_NUMBER_ID` |
   | **Temporary access token** | `WHATSAPP_ACCESS_TOKEN` |
   | **App secret** — **App settings → Basic → App secret** (Show) | `WHATSAPP_APP_SECRET` |

4. Invent a long random **verify token** (any string). You will paste the same value into Meta and into `WHATSAPP_VERIFY_TOKEN`.

Temporary tokens typically expire in about **24 hours**. For something that lasts, create a [system user](https://developers.facebook.com/docs/whatsapp/business-management-api/get-started#system-user-access-tokens) in Meta Business Suite and generate a token with `whatsapp_business_messaging` and `whatsapp_business_management`.

## 3. Allow your personal phone to message the test number

Still on **WhatsApp → API Setup**:

1. Under **To**, add your personal WhatsApp number (country code, no leading `00`).
2. WhatsApp will send a code to that phone — enter it to confirm.
3. Until you add the number, Cloud API will accept the webhook but **will not deliver** replies to you.

## 4. Run the webhook on your machine

```bash
cd whatsapp-bot
cp .env.example .env
# edit .env — phone number ID, access token, verify token, app secret
npm install
npm start
```

You should see:

```
Webhook:  http://localhost:3000/webhook
Health:   http://localhost:3000/health
```

Quick local checks (no Meta required):

```bash
# Hub challenge — should print 1158201444
curl -s "http://127.0.0.1:3000/webhook?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=1158201444"

# Fake inbound "hello" (uses WHATSAPP_APP_SECRET from the environment)
WHATSAPP_APP_SECRET=your-app-secret npm run simulate -- hello
```

Without a real token, replies are **dry-run** (printed in the server log).

## 5. Give Meta a public HTTPS URL

Meta cannot reach `localhost`. In a second terminal, from `whatsapp-bot/`:

```bash
# Cloudflare Tunnel (no account required)
npm run tunnel

# or ngrok, if you have it
npx --yes ngrok http 3000
```

Copy the `https://…` URL. Your webhook callback is:

```
https://YOUR-TUNNEL-HOST/webhook
```

Leave both `npm start` and the tunnel running.

## 6. Register the webhook in Meta

1. **WhatsApp → Configuration** (or **WhatsApp → Webhooks**).
2. **Callback URL:** `https://YOUR-TUNNEL-HOST/webhook`
3. **Verify token:** the exact `WHATSAPP_VERIFY_TOKEN` from `.env`
4. **Verify and save.** Meta sends a GET with `hub.mode`, `hub.verify_token`, and `hub.challenge`. This server returns the challenge as plain text. The dashboard should show the endpoint as verified.
5. Subscribe to the **`messages`** field on the WhatsApp Business Account. Without that subscription you will not receive inbound chats.

If verification fails: confirm the tunnel is still up, the path is `/webhook` (not `/`), and the verify tokens match.

## 7. Chat from your phone

1. On **API Setup**, use **Send** next to the test number, or start a new WhatsApp chat with the test business number Meta shows.
2. From **your** WhatsApp, send `hello`.
3. You should get a greeting. Then try `help` and `ping`.

The first message **must come from you**. After that, the bot can reply freely for about 24 hours (Meta’s customer-service window). After the window closes, send another message to open it again — template messages are not required for this starter bot.

---

## Project layout

```
whatsapp-bot/
├── .env.example          # phone number ID, access token, verify token, app secret
├── src/
│   ├── server.js         # listen
│   ├── app.js            # Express: GET challenge + POST inbound
│   ├── bot.js            # intents — extend here
│   ├── graph.js          # POST /{phone-number-id}/messages
│   ├── parse.js          # Cloud API webhook payload
│   └── signature.js      # X-Hub-Signature-256
├── scripts/simulate-inbound.js
└── test/                 # node --test
```

```bash
npm test
```

## Adding a skill

In `src/bot.js`, push another object onto `INTENTS`:

```js
{
  name: 'hours',
  match: (text) => /hours|open|closing/i.test(text),
  reply: () => 'We are open 8am–10pm. Ask again when we wire this to Kiteline.',
}
```

Inbound handling stays the same: webhook → parse → intent → Cloud API text reply.

## Troubleshooting

| Symptom | What to check |
|---|---|
| Verify fails in the dashboard | Tunnel URL + `/webhook`, `WHATSAPP_VERIFY_TOKEN` matches Meta, server logs show `webhook verified` |
| You message the test number, no reply | Your phone is on the **To** allow-list; subscribed to **messages**; access token not expired; server + tunnel still running |
| `403 Invalid signature` | `WHATSAPP_APP_SECRET` is the **App secret**, not the access token |
| Cloud API 401 / 190 | Token expired — generate a new one on API Setup |
| Cloud API 131030 | Recipient phone is not a test recipient |
| Replies stop after a day | Temporary token expired, or the 24-hour service window closed — send a new inbound message |

Official references: [create a webhook endpoint](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint/), [text messages](https://developers.facebook.com/docs/whatsapp/cloud-api/messages/text-messages/).
