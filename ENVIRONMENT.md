# Environment Configuration Guide

This application uses environment-specific configuration files to manage different deployment environments securely.

## 📁 Environment Files

### `.env.local` (Development)
- Used for local development
- Contains development database credentials
- **Never commit to git** (already in .gitignore)

### `.env.production` (Production)
- Template for production environment
- **Never commit actual production credentials to git**
- Use your hosting platform's environment variable settings instead

### `.env.example` (Template)
- Safe template showing required variables
- **Safe to commit to git**
- Copy this to create your local environment file

## 🛠️ Setup Instructions

### For Local Development:

1. **Copy the example file:**
   ```bash
   cp .env.example .env.local
   ```

2. **Edit `.env.local` with your MongoDB Atlas credentials:**
   ```env
   MONGODB_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@cluster-dev.mongodb.net/inventory-tracker?retryWrites=true&w=majority
   MONGODB_DB_NAME=inventory-tracker-dev
   NODE_ENV=development
   PORT=3000
   ```

3. **Test the connection:**
   ```bash
   npm start
   # Should show: "🔧 Loading environment: development (.env.local)"
   # Should show: "✅ MongoDB connected - using database storage"
   ```

### For Production Deployment:

#### Option 1: Platform Environment Variables (Recommended)
Most hosting platforms (Render, Heroku, Railway) let you set environment variables through their dashboard:
- `MONGODB_URI`: Your production MongoDB connection string
- `MONGODB_DB_NAME`: inventory-tracker
- `NODE_ENV`: production
- `PORT`: (usually set automatically by the platform)

#### Option 2: Production Environment File
If your platform supports it, you can create a `.env.production` file:
```env
MONGODB_URI=mongodb+srv://prod_user:prod_pass@cluster-prod.mongodb.net/inventory-tracker?retryWrites=true&w=majority
MONGODB_DB_NAME=inventory-tracker
NODE_ENV=production
PORT=3000
```

**⚠️ Security Warning:** Never commit actual production credentials to git!

## 🔍 Environment Detection

The application automatically detects the environment:

- **Development**: Uses `.env.local` file
- **Production**: Uses `.env.production` file or platform environment variables
- **Environment Detection**: Based on `NODE_ENV` variable

## 🗄️ Database Separation

### Development Database
- Database name: `inventory-tracker-dev`
- Use a separate MongoDB cluster or database for development
- Safe to experiment with test data

### Production Database  
- Database name: `inventory-tracker`
- Use a dedicated production cluster
- Enable authentication and access restrictions

## 🚀 Deployment Commands

### Development:
```bash
npm start          # Uses .env.local
npm run dev        # Uses .env.local with nodemon
npm run migrate    # Migrates data using current environment
```

### Production:
```bash
NODE_ENV=production npm start    # Forces production environment
```

## 🔐 Security Best Practices

1. **Never commit environment files with secrets**
2. **Use different databases for dev/prod**
3. **Rotate credentials regularly**
4. **Use MongoDB Atlas IP whitelist in production**
5. **Enable MongoDB authentication**
6. **Use HTTPS in production**

## 🆘 Troubleshooting

### "Database not connected" error:
1. Check your `.env.local` file exists
2. Verify MongoDB credentials are correct
3. Check MongoDB Atlas network access settings
4. Ensure your IP address is whitelisted

### Wrong environment loading:
1. Check `NODE_ENV` environment variable
2. Verify the correct `.env.*` file exists
3. Check the console output for environment detection

## 📋 Environment Variables Reference

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `MONGODB_URI` | MongoDB connection string | Yes | - |
| `MONGODB_DB_NAME` | Database name | Yes | inventory-tracker |
| `NODE_ENV` | Environment (development/production) | No | development |
| `PORT` | Server port | No | 3000 |
| `NGROK_AUTH_TOKEN` | Ngrok token for development | No | - |