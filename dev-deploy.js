#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

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

function execCommand(command, description, options = {}) {
  log(`${description}...`);
  try {
    const output = execSync(command, { 
      stdio: 'pipe',
      encoding: 'utf8',
      cwd: process.cwd(),
      ...options
    });
    logSuccess(`${description} completed`);
    return output.trim();
  } catch (error) {
    logError(`${description} failed: ${error.message}`);
    if (error.stdout) {
      console.log('stdout:', error.stdout);
    }
    if (error.stderr) {
      console.log('stderr:', error.stderr);
    }
    throw error;
  }
}

function loadConfig() {
  const defaultConfig = {
    serverPort: 3000,
    ngrokRegion: 'us',
    ngrokAuthToken: process.env.NGROK_AUTH_TOKEN || null,
    skillName: '在庫管理',
    locale: 'ja-JP',
    askProfile: 'default'
  };

  try {
    const configFile = fs.readFileSync('.dev-config.json', 'utf8');
    const userConfig = JSON.parse(configFile);
    return { ...defaultConfig, ...userConfig };
  } catch (error) {
    log('No .dev-config.json found, using defaults');
    return defaultConfig;
  }
}

function saveConfig(config) {
  fs.writeFileSync('.dev-config.json', JSON.stringify(config, null, 2));
  logSuccess('Configuration saved to .dev-config.json');
}

function checkNgrokInstalled() {
  try {
    execCommand('ngrok version', 'Checking ngrok installation');
    return true;
  } catch (error) {
    logError('ngrok not found. Please install it:');
    console.log('  brew install ngrok  # macOS');
    console.log('  or download from https://ngrok.com/');
    return false;
  }
}

function startServer(port) {
  log(`Starting server on port ${port}...`);
  
  // Check if port is already in use
  try {
    const output = execCommand(`lsof -ti:${port}`, 'Checking if port is in use', { stdio: 'pipe' });
    if (output) {
      logWarning(`Port ${port} is already in use (PID: ${output})`);
      log('Stopping existing process...');
      execCommand(`kill ${output}`, 'Stopping existing server');
      // Wait a moment for the process to stop
      execCommand('sleep 2', 'Waiting for port to be released');
    }
  } catch (error) {
    // Port not in use, continue
  }

  const serverProcess = spawn('node', ['server.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, PORT: port }
  });

  return new Promise((resolve, reject) => {
    let started = false;
    
    serverProcess.stdout.on('data', (data) => {
      const message = data.toString();
      console.log(`[SERVER] ${message.trim()}`);
      
      if (message.includes('running on port') && !started) {
        started = true;
        logSuccess(`Server started on port ${port}`);
        resolve(serverProcess);
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`[SERVER ERROR] ${data.toString().trim()}`);
    });

    serverProcess.on('error', (error) => {
      if (!started) {
        reject(error);
      }
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!started) {
        reject(new Error('Server startup timeout'));
      }
    }, 10000);
  });
}

function startNgrok(port, region, authToken) {
  log(`Starting ngrok tunnel for port ${port}...`);

  const ngrokArgs = ['http', port.toString(), '--region', region];
  
  if (authToken) {
    // Set auth token first
    try {
      execCommand(`ngrok config add-authtoken ${authToken}`, 'Setting ngrok auth token');
    } catch (error) {
      logWarning('Failed to set ngrok auth token, continuing anyway...');
    }
  }

  const ngrokProcess = spawn('ngrok', ngrokArgs, {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  return new Promise((resolve, reject) => {
    let tunnelUrl = null;
    
    ngrokProcess.stdout.on('data', (data) => {
      const message = data.toString();
      console.log(`[NGROK] ${message.trim()}`);
    });

    ngrokProcess.stderr.on('data', (data) => {
      const message = data.toString();
      console.log(`[NGROK] ${message.trim()}`);
      
      // Look for the tunnel URL in ngrok output
      const urlMatch = message.match(/https:\/\/[a-zA-Z0-9-]+\.ngrok-free\.app/);
      if (urlMatch && !tunnelUrl) {
        tunnelUrl = urlMatch[0];
        logSuccess(`Ngrok tunnel established: ${tunnelUrl}`);
        resolve({ process: ngrokProcess, url: tunnelUrl });
      }
    });

    ngrokProcess.on('error', (error) => {
      reject(error);
    });

    // Timeout after 15 seconds
    setTimeout(() => {
      if (!tunnelUrl) {
        // Try to get tunnel info via API
        try {
          const response = execCommand('curl -s http://localhost:4040/api/tunnels', 'Getting ngrok tunnel info');
          const tunnels = JSON.parse(response);
          if (tunnels.tunnels && tunnels.tunnels.length > 0) {
            tunnelUrl = tunnels.tunnels[0].public_url;
            if (tunnelUrl.startsWith('http://')) {
              tunnelUrl = tunnelUrl.replace('http://', 'https://');
            }
            logSuccess(`Ngrok tunnel found via API: ${tunnelUrl}`);
            resolve({ process: ngrokProcess, url: tunnelUrl });
          } else {
            reject(new Error('Ngrok tunnel startup timeout - no URL detected'));
          }
        } catch (error) {
          reject(new Error('Ngrok tunnel startup timeout'));
        }
      }
    }, 15000);
  });
}

function updateSkillEndpoint(tunnelUrl, skillName, locale, askProfile) {
  const endpoint = `${tunnelUrl}/api/alexa`;
  
  log('Updating skill endpoint configuration...');
  
  // Find existing skill
  let skillId = null;
  try {
    const skillListOutput = execCommand(`ask skill list --profile ${askProfile}`, 'Finding existing skill');
    const skillList = JSON.parse(skillListOutput);
    
    const skill = skillList.skills?.find(s => 
      s.nameByLocale?.[locale] === skillName
    );
    
    if (skill) {
      skillId = skill.skillId;
      logSuccess(`Found existing skill: ${skillId}`);
    }
  } catch (error) {
    logWarning('Could not find existing skill');
  }

  // Update skill.json with new endpoint
  try {
    const skillJsonPath = 'skill-package/skill.json';
    const skillJson = JSON.parse(fs.readFileSync(skillJsonPath, 'utf8'));
    
    skillJson.manifest.apis.custom.endpoint.uri = endpoint;
    
    fs.writeFileSync(skillJsonPath, JSON.stringify(skillJson, null, 2));
    logSuccess(`Updated skill.json with endpoint: ${endpoint}`);
    
    if (skillId) {
      // Update existing skill manifest
      execCommand(
        `ask smapi update-skill-manifest --skill-id ${skillId} --stage development --manifest file:${skillJsonPath} --profile ${askProfile}`,
        'Updating skill manifest with new endpoint'
      );
      logSuccess('Skill endpoint updated successfully');
      return skillId;
    }
  } catch (error) {
    logError(`Failed to update skill endpoint: ${error.message}`);
  }
  
  return skillId;
}

async function main() {
  const startTime = Date.now();
  
  log('🎯 Starting Development Deployment Pipeline');
  console.log('');
  
  // Load configuration
  const config = loadConfig();
  
  try {
    // Step 1: Run tests
    log('📋 Step 1: Running test suite');
    execCommand('npm test', 'Running unit tests');
    console.log('');
    
    // Step 2: Check prerequisites
    log('🔧 Step 2: Checking prerequisites');
    
    if (!checkNgrokInstalled()) {
      process.exit(1);
    }
    
    try {
      execCommand(`ask --version --profile ${config.askProfile}`, 'Checking ASK CLI configuration');
    } catch (error) {
      logError(`ASK CLI not configured for profile '${config.askProfile}'. Please run: ask configure --profile ${config.askProfile}`);
      process.exit(1);
    }
    console.log('');
    
    // Step 3: Start local server
    log('🖥️ Step 3: Starting local server');
    const serverProcess = await startServer(config.serverPort);
    console.log('');
    
    // Step 4: Start ngrok tunnel
    log('🌐 Step 4: Starting ngrok tunnel');
    const ngrok = await startNgrok(config.serverPort, config.ngrokRegion, config.ngrokAuthToken);
    console.log('');
    
    // Step 5: Update skill configuration
    log('⚙️ Step 5: Updating Alexa skill configuration');
    const skillId = updateSkillEndpoint(ngrok.url, config.skillName, config.locale, config.askProfile);
    console.log('');
    
    // Step 6: Save configuration
    log('💾 Step 6: Saving configuration');
    const devConfig = {
      ...config,
      lastTunnelUrl: ngrok.url,
      lastDeployed: new Date().toISOString(),
      skillId: skillId,
      serverPid: serverProcess.pid,
      ngrokPid: ngrok.process.pid
    };
    
    saveConfig(devConfig);
    
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    logSuccess(`🎉 Development environment ready in ${elapsed} seconds!`);
    
    console.log('');
    console.log(`${colors.bright}Development Environment Details:${colors.reset}`);
    console.log(`  Local Server: http://localhost:${config.serverPort}`);
    console.log(`  Public URL: ${ngrok.url}`);
    console.log(`  Alexa Endpoint: ${ngrok.url}/api/alexa`);
    if (skillId) {
      console.log(`  Skill ID: ${skillId}`);
    }
    console.log('');
    console.log(`${colors.bright}Testing Commands:${colors.reset}`);
    if (skillId) {
      console.log(`  Interactive testing: ${colors.cyan}ask dialog --locale ${config.locale} --skill-id ${skillId} --profile ${config.askProfile}${colors.reset}`);
    }
    console.log(`  Test endpoint: ${colors.cyan}curl ${ngrok.url}/api/alexa${colors.reset}`);
    console.log(`  View logs: ${colors.cyan}tail -f server.log${colors.reset} (if logging to file)`);
    console.log('');
    console.log(`${colors.yellow}${colors.bright}Press Ctrl+C to stop all processes${colors.reset}`);
    
    // Keep processes running
    const cleanup = () => {
      console.log('\\n');
      logWarning('Shutting down development environment...');
      
      try {
        serverProcess.kill('SIGTERM');
        logSuccess('Server stopped');
      } catch (error) {
        logWarning('Server already stopped');
      }
      
      try {
        ngrok.process.kill('SIGTERM');
        logSuccess('Ngrok tunnel stopped');
      } catch (error) {
        logWarning('Ngrok already stopped');
      }
      
      process.exit(0);
    };
    
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    
    // Wait indefinitely
    await new Promise(() => {});
    
  } catch (error) {
    logError(`Development deployment failed: ${error.message}`);
    console.log('');
    console.log(`${colors.yellow}Common solutions:${colors.reset}`);
    console.log('1. Check if ngrok is installed and authenticated');
    console.log('2. Verify ASK CLI configuration: ask configure');
    console.log('3. Make sure port 3000 is available');
    console.log('4. Check internet connection for ngrok tunnel');
    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\\n');
  logWarning('Development deployment interrupted by user');
  process.exit(1);
});

main();