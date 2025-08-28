# Siri Shortcuts Setup Guide

## Prerequisites
1. Install the "Shortcuts" app on your iPhone (comes pre-installed on iOS 12+)
2. Have your inventory tracker server running and accessible

## Create "Add Item" Shortcut

1. Open the Shortcuts app
2. Tap the "+" to create a new shortcut
3. Add these actions in order:

### Action 1: Ask for Spoken Text
- Search for "Ask for Spoken Text"
- Set the prompt to: "What did you add to your inventory?"
- This will capture something like "4 carrots to the fridge"

### Action 2: Get Text from Input
- Search for "Get Text from Input"
- This passes the spoken text to the next action

### Action 3: Get URLs
- Search for "Get URLs"
- Set URL to: `http://YOUR_SERVER_IP:3000/api/inventory/add`
- Replace YOUR_SERVER_IP with your server's IP address

### Action 4: Get Contents of URL
- Search for "Get Contents of URL" 
- Set Method to: POST
- Set Request Body to: JSON
- Add these JSON fields:
  ```json
  {
    "item": "carrots",
    "quantity": 4,
    "location": "fridge"
  }
  ```
- Note: For a basic version, you'll need to manually parse the spoken text

### Action 5: Speak Text
- Search for "Speak Text"
- Set text to: "Added to inventory"

## Create "Check Item" Shortcut

1. Create another shortcut
2. Add these actions:

### Action 1: Ask for Spoken Text
- Prompt: "What item do you want to check?"

### Action 2: Get URLs
- URL: `http://YOUR_SERVER_IP:3000/api/inventory/[ITEM_NAME]`

### Action 3: Get Contents of URL
- Method: GET

### Action 4: Get Value for Key
- Key: "quantity"

### Action 5: Speak Text
- Text: "You have [quantity] items"

## Advanced Parsing (Optional)

For better voice parsing, you can use the "Get Numbers from Input" and "Split Text" actions to extract quantities and item names from natural speech.

## Usage

Once set up, you can say:
- "Hey Siri, Add Item" - then speak "4 carrots to the fridge"
- "Hey Siri, Check Item" - then speak "carrots"

## Notes

- Replace `YOUR_SERVER_IP` with your actual server IP address
- Make sure your server is accessible from your phone's network
- For production use, consider using HTTPS and a proper domain
- You may need to adjust the shortcuts based on your specific voice patterns