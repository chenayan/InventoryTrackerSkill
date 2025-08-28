# Complete Alexa Skill Setup Instructions

## Step 1: Make Your Server Public (Using ngrok)

First, your server needs to be accessible from the internet:

```bash
# Install ngrok if you haven't already
npm install -g ngrok

# Start your inventory server (in one terminal)
npm start

# In a NEW terminal, expose your server
ngrok http 3000
```

**IMPORTANT:** Copy the HTTPS URL that ngrok shows (looks like `https://abc123.ngrok.io`)

## Step 2: Create Alexa Skill

1. Go to [developer.amazon.com](https://developer.amazon.com)
2. Sign in with your Amazon account
3. Click **"Alexa Skills Kit"** → **"Create Skill"**
4. Fill in:
   - **Skill name:** `在庫管理` (or "Inventory Management")
   - **Default language:** `Japanese (JP)` ⚠️ IMPORTANT: Choose Japanese!
   - **Choose a model:** `Custom`
   - **Choose a method to host:** `Provision your own`
5. Click **"Create skill"**

## Step 3: Configure Interaction Model

1. In the left sidebar, click **"JSON Editor"**
2. Delete all existing content
3. Copy the ENTIRE contents of your `alexa-skill.json` file and paste it
4. Click **"Save Model"**
5. Click **"Build Model"** (wait for it to finish)

## Step 4: Set Up Endpoint

1. In the left sidebar, click **"Endpoint"**
2. Select **"HTTPS"**
3. In the **"Default Region"** field, paste your ngrok HTTPS URL + `/api/alexa`
   - Example: `https://abc123.ngrok.io/api/alexa`
4. From the dropdown, select: **"My development endpoint is a sub-domain of a domain that has a wildcard certificate from a certificate authority"**
5. Click **"Save Endpoints"**

## Step 5: Test Your Skill

1. Click the **"Test"** tab at the top
2. Enable testing by selecting **"Development"** from the dropdown
3. Try these test phrases:

### Test Connection First:
- Type or say: **"在庫管理を開いて"** (open inventory management)
- Then: **"在庫管理テスト"** (inventory management test)

### If Test Works, Try Real Commands:
- **"にんじんを4個冷蔵庫に追加した"** (added 4 carrots to fridge)
- **"冷蔵庫のにんじんはいくつある"** (how many carrots in fridge)

## Step 6: Use on Your Alexa Device

Once testing works in the developer console, the skill will automatically be available on Alexa devices linked to your Amazon account.

Say: **"アレクサ、在庫管理を開いて"**

## Common Issues & Solutions

### ❌ "I can't find a skill called..."
- Make sure you selected **Japanese (JP)** as the language
- The skill is only available on the account you created it with

### ❌ "There was a problem with the requested skill's response"
- Check that ngrok is still running
- Verify your endpoint URL is correct with `/api/alexa` at the end
- Make sure your server (`npm start`) is running

### ❌ Skill responds in English
- Double-check you selected Japanese as the language when creating the skill
- Rebuild your model after making changes

### ❌ "I don't understand that"
- Try the exact test phrase: **"在庫管理テスト"**
- Make sure your interaction model was saved and built successfully

## Troubleshooting Checklist

Before asking for help, verify:
- [ ] Server is running (`npm start` shows "server running on port 3000")
- [ ] ngrok is running and shows HTTPS URL
- [ ] Alexa skill language is set to Japanese (JP)
- [ ] Endpoint URL includes `/api/alexa` at the end
- [ ] Model was saved and built successfully in developer console
- [ ] Testing is enabled in the Test tab

## Your Test Commands

Start with these simple test phrases:
1. **"在庫管理を開いて"** (opens the skill)
2. **"在庫管理テスト"** (tests connection - should respond with current time)
3. **"にんじんを4個冷蔵庫に追加した"** (adds 4 carrots)
4. **"冷蔵庫のにんじんはいくつある"** (checks carrot count)

If the test command works, your skill is set up correctly!