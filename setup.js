#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.cyan) {
  console.log(`${color}${colors.bright}🚀 ${message}${colors.reset}`);
}

function logSuccess(message) {
  console.log(`${colors.green}${colors.bright}✅ ${message}${colors.reset}`);
}

function logError(message) {
  console.log(`${colors.red}${colors.bright}❌ ${message}${colors.reset}`);
}

function logWarning(message) {
  console.log(`${colors.yellow}${colors.bright}⚠️ ${message}${colors.reset}`);
}

function logInfo(message) {
  console.log(`${colors.blue}${colors.bright}ℹ️ ${message}${colors.reset}`);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(`${colors.cyan}${question}${colors.reset} `, resolve);
  });
}

function execCommand(command, description, options = {}) {
  log(`${description}...`);
  try {
    const output = execSync(command, { 
      stdio: options.silent ? 'pipe' : 'inherit',
      encoding: 'utf8',
      cwd: process.cwd(),
      ...options
    });
    logSuccess(`${description} completed`);
    return typeof output === 'string' ? output.trim() : output;
  } catch (error) {
    if (!options.allowFailure) {
      logError(`${description} failed: ${error.message}`);
      if (error.stdout) {
        console.log('stdout:', error.stdout);
      }
      if (error.stderr) {
        console.log('stderr:', error.stderr);
      }
      throw error;
    }
    return null;
  }
}

function detectOS() {
  const platform = process.platform;
  switch (platform) {
    case 'darwin':
      return 'macOS';
    case 'linux':
      return 'Linux';
    case 'win32':
      return 'Windows';
    default:
      return platform;
  }
}

function checkCommand(command, name) {
  try {
    execCommand(`${command} --version`, `Checking ${name}`, { silent: true });
    return true;
  } catch (error) {
    return false;
  }
}

async function installHomebrew() {
  if (checkCommand('brew', 'Homebrew')) {
    logSuccess('Homebrew already installed');
    return true;
  }

  logWarning('Homebrew not found. Installing Homebrew...');
  try {
    const installScript = '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"';
    execCommand(installScript, 'Installing Homebrew');
    return true;
  } catch (error) {
    logError('Failed to install Homebrew. Please install manually: https://brew.sh/');
    return false;
  }
}

async function installNodeJS() {
  if (checkCommand('node', 'Node.js')) {
    const version = execCommand('node --version', 'Getting Node.js version', { silent: true });
    logSuccess(`Node.js already installed: ${version}`);
    return true;
  }

  const os = detectOS();
  logWarning('Node.js not found. Installing Node.js...');

  try {
    if (os === 'macOS') {
      if (await installHomebrew()) {
        execCommand('brew install node', 'Installing Node.js via Homebrew');
      } else {
        throw new Error('Homebrew required for Node.js installation');
      }
    } else if (os === 'Linux') {
      // Try different package managers
      if (checkCommand('apt', 'apt')) {
        execCommand('sudo apt update && sudo apt install -y nodejs npm', 'Installing Node.js via apt');
      } else if (checkCommand('yum', 'yum')) {
        execCommand('sudo yum install -y nodejs npm', 'Installing Node.js via yum');
      } else if (checkCommand('dnf', 'dnf')) {
        execCommand('sudo dnf install -y nodejs npm', 'Installing Node.js via dnf');
      } else {
        throw new Error('No compatible package manager found');
      }
    } else if (os === 'Windows') {
      logError('Windows detected. Please install Node.js manually from: https://nodejs.org/');
      return false;
    } else {
      throw new Error(`Unsupported operating system: ${os}`);
    }
    
    logSuccess('Node.js installed successfully');
    return true;
  } catch (error) {
    logError(`Failed to install Node.js: ${error.message}`);
    logInfo('Please install Node.js manually from: https://nodejs.org/');
    return false;
  }
}

async function installNgrok() {
  if (checkCommand('ngrok', 'ngrok')) {
    logSuccess('ngrok already installed');
    return true;
  }

  const os = detectOS();
  logWarning('ngrok not found. Installing ngrok...');

  try {
    if (os === 'macOS') {
      if (await installHomebrew()) {
        execCommand('brew install ngrok/ngrok/ngrok', 'Installing ngrok via Homebrew');
      } else {
        throw new Error('Homebrew required for ngrok installation');
      }
    } else if (os === 'Linux') {
      // Download and install ngrok manually for Linux
      const arch = process.arch === 'x64' ? 'amd64' : 'arm64';
      execCommand(`curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null && echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list && sudo apt update && sudo apt install ngrok`, 'Installing ngrok via package manager');
    } else if (os === 'Windows') {
      logError('Windows detected. Please install ngrok manually from: https://ngrok.com/download');
      return false;
    } else {
      throw new Error(`Unsupported operating system: ${os}`);
    }
    
    logSuccess('ngrok installed successfully');
    return true;
  } catch (error) {
    logError(`Failed to install ngrok: ${error.message}`);
    logInfo('Please install ngrok manually from: https://ngrok.com/download');
    return false;
  }
}

async function installASKCLI() {
  if (checkCommand('ask', 'ASK CLI')) {
    logSuccess('ASK CLI already installed');
    return true;
  }

  logWarning('ASK CLI not found. Installing ASK CLI...');
  try {
    execCommand('npm install -g ask-cli', 'Installing ASK CLI via npm');
    logSuccess('ASK CLI installed successfully');
    return true;
  } catch (error) {
    logError(`Failed to install ASK CLI: ${error.message}`);
    logInfo('Please install ASK CLI manually: npm install -g ask-cli');
    return false;
  }
}

async function configureNgrok() {
  logInfo('ngrok requires an auth token for persistent tunnels');
  console.log('');
  console.log('To get your ngrok auth token:');
  console.log('1. Sign up at https://dashboard.ngrok.com/signup');
  console.log('2. Go to https://dashboard.ngrok.com/get-started/your-authtoken');
  console.log('3. Copy your auth token');
  console.log('');

  const hasToken = await askQuestion('Do you have an ngrok auth token? (y/n): ');
  
  if (hasToken.toLowerCase().startsWith('y')) {
    const authToken = await askQuestion('Enter your ngrok auth token: ');
    if (authToken.trim()) {
      try {
        execCommand(`ngrok config add-authtoken ${authToken.trim()}`, 'Configuring ngrok auth token');
        return authToken.trim();
      } catch (error) {
        logWarning('Failed to set ngrok auth token, but continuing...');
      }
    }
  }
  
  logWarning('Continuing without ngrok auth token. You may have limited tunnel time.');
  return null;
}

async function configureASK() {
  logInfo('ASK CLI requires AWS and Amazon Developer credentials');
  console.log('');
  console.log('To configure ASK CLI:');
  console.log('1. You need an Amazon Developer Account: https://developer.amazon.com/');
  console.log('2. You need an AWS Account for Lambda hosting (optional): https://aws.amazon.com/');
  console.log('');

  const shouldConfigure = await askQuestion('Would you like to configure ASK CLI now? (y/n): ');
  
  if (shouldConfigure.toLowerCase().startsWith('y')) {
    try {
      logInfo('Starting ASK CLI configuration...');
      console.log('');
      console.log(`${colors.yellow}Please follow the prompts to:${colors.reset}`);
      console.log('1. Sign in to your Amazon Developer Account');
      console.log('2. Choose whether to link AWS account (for Lambda)');
      console.log('3. Select your AWS profile (if applicable)');
      console.log('');
      
      // Use spawn instead of execSync for interactive commands
      const askProcess = spawn('ask', ['configure'], { 
        stdio: 'inherit'
      });
      
      return new Promise((resolve) => {
        askProcess.on('close', (code) => {
          if (code === 0) {
            logSuccess('ASK CLI configured successfully');
            resolve(true);
          } else {
            logWarning('ASK CLI configuration may not be complete');
            resolve(false);
          }
        });
      });
    } catch (error) {
      logError(`Failed to configure ASK CLI: ${error.message}`);
      logInfo('You can configure ASK CLI later with: ask configure');
      return false;
    }
  } else {
    logInfo('Skipping ASK CLI configuration. You can configure later with: ask configure');
    return false;
  }
}

async function createConfiguration() {
  logInfo('Setting up project configuration...');
  
  const config = {
    serverPort: 3000,
    ngrokRegion: 'us',
    ngrokAuthToken: null,
    skillName: '在庫管理',
    locale: 'ja-JP',
    askProfile: 'default'
  };

  // Ask for custom configuration
  const customize = await askQuestion('Would you like to customize the configuration? (y/n): ');
  
  if (customize.toLowerCase().startsWith('y')) {
    const port = await askQuestion(`Server port (${config.serverPort}): `);
    if (port.trim()) config.serverPort = parseInt(port.trim()) || config.serverPort;

    const region = await askQuestion(`ngrok region (${config.ngrokRegion}): `);
    if (region.trim()) config.ngrokRegion = region.trim();

    const skillName = await askQuestion(`Skill name (${config.skillName}): `);
    if (skillName.trim()) config.skillName = skillName.trim();

    const locale = await askQuestion(`Locale (${config.locale}): `);
    if (locale.trim()) config.locale = locale.trim();

    const profile = await askQuestion(`ASK CLI profile (${config.askProfile}): `);
    if (profile.trim()) config.askProfile = profile.trim();
  }

  // Save configuration
  fs.writeFileSync('.dev-config.json', JSON.stringify(config, null, 2));
  logSuccess('Configuration saved to .dev-config.json');
  
  return config;
}

async function main() {
  console.log(`${colors.magenta}${colors.bright}`);
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                  Inventory Tracker Setup                     ║');
  console.log('║              Voice-Controlled Inventory System               ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}`);
  console.log('');
  
  const os = detectOS();
  logInfo(`Detected operating system: ${os}`);
  console.log('');

  try {
    // Step 1: Install Node.js dependencies
    log('📦 Step 1: Installing project dependencies');
    execCommand('npm install', 'Installing npm dependencies');
    console.log('');

    // Step 2: Check and install Node.js
    log('🟢 Step 2: Checking Node.js installation');
    await installNodeJS();
    console.log('');

    // Step 3: Check and install ngrok
    log('🌐 Step 3: Checking ngrok installation');
    const ngrokInstalled = await installNgrok();
    console.log('');

    // Step 4: Configure ngrok
    if (ngrokInstalled) {
      log('🔑 Step 4: Configuring ngrok');
      const ngrokToken = await configureNgrok();
      console.log('');
    }

    // Step 5: Check and install ASK CLI
    log('🗣️ Step 5: Checking ASK CLI installation');
    const askInstalled = await installASKCLI();
    console.log('');

    // Step 6: Configure ASK CLI
    if (askInstalled) {
      log('⚙️ Step 6: Configuring ASK CLI');
      await configureASK();
      console.log('');
    }

    // Step 7: Create project configuration
    log('📝 Step 7: Setting up project configuration');
    const config = await createConfiguration();
    console.log('');

    // Step 8: Run tests to verify setup
    log('🧪 Step 8: Running tests to verify setup');
    execCommand('npm test', 'Running test suite');
    console.log('');

    // Setup complete
    logSuccess('🎉 Setup completed successfully!');
    console.log('');
    console.log(`${colors.bright}Next Steps:${colors.reset}`);
    console.log(`  ${colors.green}Development:${colors.reset} npm run dev-deploy`);
    console.log(`  ${colors.green}Production:${colors.reset}  npm run deploy`);
    console.log(`  ${colors.green}Tests:${colors.reset}       npm test`);
    console.log(`  ${colors.green}Stop dev:${colors.reset}    npm run stop-dev`);
    console.log('');
    console.log(`${colors.bright}Configuration Files:${colors.reset}`);
    console.log(`  ${colors.cyan}.dev-config.json${colors.reset}     - Development settings`);
    console.log(`  ${colors.cyan}skill-package/${colors.reset}       - Alexa skill definition`);
    console.log('');
    console.log(`${colors.bright}Documentation:${colors.reset}`);
    console.log(`  ${colors.cyan}README.md${colors.reset}           - Project documentation`);
    console.log(`  ${colors.cyan}skill-package/skill.json${colors.reset} - Skill manifest`);
    console.log('');

    if (!askInstalled || !ngrokInstalled) {
      console.log(`${colors.yellow}${colors.bright}⚠️ Some tools couldn't be installed automatically:${colors.reset}`);
      if (!ngrokInstalled) {
        console.log(`  • ngrok: https://ngrok.com/download`);
      }
      if (!askInstalled) {
        console.log(`  • ASK CLI: npm install -g ask-cli`);
      }
      console.log('');
    }

  } catch (error) {
    logError(`Setup failed: ${error.message}`);
    console.log('');
    console.log(`${colors.yellow}Manual Installation Instructions:${colors.reset}`);
    console.log('1. Install Node.js: https://nodejs.org/');
    console.log('2. Install dependencies: npm install');
    console.log('3. Install ngrok: https://ngrok.com/download');
    console.log('4. Install ASK CLI: npm install -g ask-cli');
    console.log('5. Configure ASK CLI: ask configure');
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\\n');
  logWarning('Setup interrupted by user');
  rl.close();
  process.exit(1);
});

main();