# Inventory Tracker

Voice-controlled inventory tracking system for Alexa using Japanese commands. Track items in your fridge by saying "にんじんを4個冷蔵庫に追加した" (I added 4 carrots to the fridge) and check quantities later.

## Quick Start

### For New Users (Just Cloned)

1. **Setup environment configuration:**
```bash
cp .env.example .env.local
# Edit .env.local with your MongoDB Atlas credentials
```

2. **Run automated setup:**
```bash
npm run setup
```

This interactive setup script will:
- Install Node.js, ngrok, and ASK CLI  
- Configure authentication tokens
- Set up project configuration
- Run tests to verify everything works

📋 **Need help with MongoDB setup?** See [ENVIRONMENT.md](./ENVIRONMENT.md) for detailed database configuration.

### Development Workflow

```bash
# Start complete dev environment (server + ngrok + skill update)
npm run dev-deploy

# Stop all development processes
npm run stop-dev

# Run tests
npm test

# Deploy to production
npm run deploy
```

## Features

- **Voice Commands**: Japanese voice interface for Alexa
- **Real-time Inventory**: Track additions, removals, and quantities
- **Local Development**: Automatic ngrok tunneling and skill configuration
- **Test-First Development**: Comprehensive unit test suite
- **Automated Deployment**: Zero-config deployment pipelines

## Voice Commands

| Japanese | English | Function |
|----------|---------|----------|
| `在庫管理を開いて` | Open inventory management | Launch skill |
| `にんじんを4個冷蔵庫に追加した` | Added 4 carrots to fridge | Add items |
| `にんじんはいくつある` | How many carrots are there | Check quantity |
| `たまごを3個使った` | Used 3 eggs | Remove items |
| `テスト` | Test | Test connection |

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│     Alexa       │───▶│   ngrok Tunnel   │───▶│  Local Server   │
│   (Voice UI)    │    │ (Public Access)  │    │  (Express.js)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────┐
                                               │    MongoDB      │
                                               │ Atlas Database  │
                                               │ (Multi-User +   │
                                               │  Persistence)   │
                                               └─────────────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────┐
                                               │  File Storage   │
                                               │   (Fallback)    │
                                               └─────────────────┘
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run setup` | Complete environment setup for new users |
| `npm run dev-deploy` | Start development environment with ngrok |
| `npm run stop-dev` | Stop all development processes |
| `npm run deploy` | Production deployment to Alexa |
| `npm run migrate` | Migrate file storage data to MongoDB |
| `npm test` | Run comprehensive test suite |
| `npm start` | Start server only |
| `npm run dev` | Start server with auto-reload |

## Configuration

### Development Configuration (.dev-config.json)
```json
{
  "serverPort": 3000,
  "ngrokRegion": "us",
  "ngrokAuthToken": "your-token-here",
  "skillName": "在庫管理",
  "locale": "ja-JP",
  "askProfile": "default"
}
```

### Environment Variables
- `NGROK_AUTH_TOKEN`: ngrok authentication token
- `PORT`: Server port (defaults to 3000)

## Prerequisites

The setup script will install these automatically, but you can install manually:

### Required Tools
- [Node.js](https://nodejs.org/) (v14+)
- [ngrok](https://ngrok.com/) - For local development tunnels
- [ASK CLI](https://developer.amazon.com/docs/smapi/quick-start-alexa-skills-kit-command-line-interface.html) - Alexa Skills Kit CLI

### Accounts Needed
- [Amazon Developer Account](https://developer.amazon.com/) - For Alexa skills
- [ngrok Account](https://dashboard.ngrok.com/) - For persistent tunnels (optional)

## Development

### Local Testing
```bash
# Start development environment
npm run dev-deploy

# Test via curl
curl -X POST http://localhost:3000/api/alexa \
  -H "Content-Type: application/json" \
  -d '{"request":{"type":"IntentRequest","intent":{"name":"AddCarrotsIntent","slots":{"Quantity":{"value":"4"}}}}}'

# Test via Alexa Developer Console
ask dialog --locale ja-JP --skill-id YOUR_SKILL_ID
```

### Adding New Food Items

1. Update `japaneseToEnglish` mapping in `server.js`
2. Add new intent to `skill-package/interactionModels/custom/ja-JP.json`
3. Implement intent handler in server
4. Add tests in `__tests__/inventory-operations.test.js`
5. Deploy: `npm run deploy`

### Project Structure
```
inventory-tracker/
├── server.js                      # Main Express server
├── deploy.js                     # Production deployment
├── dev-deploy.js                 # Development deployment
├── setup.js                      # New user setup
├── stop-dev.js                   # Stop development
├── skill-package/               # Alexa skill definition
│   ├── skill.json              # Skill manifest
│   └── interactionModels/
│       └── custom/
│           └── ja-JP.json      # Japanese interaction model
├── __tests__/                   # Test suite
│   ├── api.test.js
│   ├── alexa.test.js
│   ├── inventory-operations.test.js
│   └── utils.test.js
└── .dev-config.json            # Development configuration
```

## Testing

### Test Categories
- **API Tests**: REST endpoint functionality
- **Alexa Tests**: Voice interface integration  
- **Inventory Tests**: Core business logic
- **Utils Tests**: Helper functions

### Running Tests
```bash
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm test -- --verbose       # Detailed output
```

## Deployment

### Development Deployment
```bash
npm run dev-deploy
```
- Starts local server
- Creates ngrok tunnel
- Updates Alexa skill endpoint
- Keeps running until Ctrl+C

### Production Deployment  
```bash
npm run deploy
```
- Runs test suite
- Deploys to configured skill ID
- Updates interaction model
- Waits for build completion

## Troubleshooting

### Common Issues

**Port 3000 already in use**
```bash
npm run stop-dev  # Stop all processes
# or manually: lsof -ti:3000 | xargs kill
```

**ngrok tunnel fails**
```bash
# Set auth token
ngrok config add-authtoken YOUR_TOKEN
```

**ASK CLI not configured**
```bash
ask configure  # Follow interactive setup
```

**Tests failing**
```bash
npm run stop-dev  # Ensure no conflicting processes
npm test          # Check specific errors
```

### Debug Mode
```bash
DEBUG=* npm run dev-deploy  # Verbose logging
```

## Contributing

1. Fork the repository
2. Run `npm run setup` to configure environment
3. Make changes and add tests
4. Run `npm test` to verify
5. Submit pull request

## License

MIT License - see LICENSE file for details.
