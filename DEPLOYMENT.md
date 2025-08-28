# Free Cloud Hosting Deployment Guide

Since your inventory tracker now has MongoDB Atlas for persistence, you can deploy to free hosting providers without worrying about data loss. Here are the best options for minimal cost with no public visibility requirements.

## 🆓 Recommended Free Hosting Providers

### 1. **Render** (Best Overall)
- **Free Tier**: 750 hours/month, sleeps after 15min of inactivity
- **Pros**: Easy setup, automatic HTTPS, great for private apps
- **Cons**: Cold starts when waking from sleep
- **Perfect for**: Personal inventory tracker with MongoDB

### 2. **Railway** (Most Developer-Friendly)
- **Free Tier**: $5/month in credits (ongoing)
- **Pros**: Excellent developer experience, fast deployments
- **Cons**: Credit-based system
- **Perfect for**: Apps you actively develop

### 3. **Cyclic** (True Serverless)
- **Free Tier**: Generous limits, serverless architecture
- **Pros**: No cold starts, fast response times
- **Cons**: Newer platform, less mature
- **Perfect for**: Always-responsive apps

### 4. **Fly.io** (Global Edge)
- **Free Tier**: 3 VMs with 256MB RAM each
- **Pros**: Global edge deployment, very fast
- **Cons**: More complex setup
- **Perfect for**: Performance-critical apps

## 🚀 Deployment Instructions

### Option A: Render (Recommended)

1. **Prepare Repository**:
   ```bash
   # Ensure your code is committed
   git add .
   git commit -m "Ready for Render deployment"
   git push origin main
   ```

2. **Deploy to Render**:
   - Go to [render.com](https://render.com) and sign up
   - Connect your GitHub account
   - Click "New +" → "Web Service"
   - Select your inventory-tracker repository
   - Configure:
     - **Name**: `inventory-tracker`
     - **Environment**: `Node`
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
     - **Instance Type**: Free

3. **Set Environment Variables**:
   ```
   NODE_ENV=production
   MONGODB_URI=mongodb+srv://your_user:your_pass@cluster.mongodb.net/inventory-tracker?retryWrites=true&w=majority
   MONGODB_DB_NAME=inventory-tracker
   ```

4. **Deploy**: Click "Create Web Service"
   - Render will provide a URL like: `https://inventory-tracker-xyz.onrender.com`
   - Your Alexa endpoint: `https://inventory-tracker-xyz.onrender.com/api/alexa`

### Option B: Railway

1. **Deploy via GitHub**:
   - Go to [railway.app](https://railway.app) and sign up
   - Click "Deploy from GitHub repo"
   - Select your repository
   - Railway auto-detects Node.js and deploys

2. **Set Environment Variables**:
   - Go to your service → "Variables"
   - Add:
     ```
     NODE_ENV=production
     MONGODB_URI=mongodb+srv://your_user:your_pass@cluster.mongodb.net/inventory-tracker?retryWrites=true&w=majority
     MONGODB_DB_NAME=inventory-tracker
     ```

3. **Get URL**: Railway provides a URL like `https://inventory-tracker-production.up.railway.app`

### Option C: Cyclic

1. **Deploy from GitHub**:
   - Go to [cyclic.sh](https://cyclic.sh) and sign up
   - Click "Link Your Own" → select repository
   - Click "Connect Cyclic"

2. **Environment Variables**:
   - Go to "Advanced" → "Environment"
   - Add your MongoDB variables

3. **Deploy**: Automatic deployment, gets URL like `https://inventory-tracker.cyclic.app`

## ⚙️ Environment Configuration

### For All Platforms:
Set these environment variables in your hosting platform:

```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/inventory-tracker?retryWrites=true&w=majority
MONGODB_DB_NAME=inventory-tracker
PORT=3000
```

### MongoDB Atlas Security:
1. **Update Network Access**:
   - Go to MongoDB Atlas → Network Access
   - Add IP Address: `0.0.0.0/0` (allow all - safe for free hosting)
   - Or add your hosting platform's IP ranges

2. **Create Production User**:
   - Go to Database Access
   - Create new user with "Read and write to any database"
   - Use strong password

## 🔒 Private App Configuration

Since you want minimal visibility, all these platforms offer:

- **Private URLs**: Not indexed by search engines
- **No public directory**: Your app won't be discoverable
- **HTTPS by default**: Secure communication
- **Environment isolation**: Separate from development

## 🧪 Testing Your Deployment

1. **Test API endpoints**:
   ```bash
   # Add item
   curl -X POST https://your-app.onrender.com/api/inventory/add \
     -H "Content-Type: application/json" \
     -d '{"item": "test", "quantity": 1}'

   # Get inventory
   curl https://your-app.onrender.com/api/inventory
   ```

2. **Test Alexa endpoint**:
   - Update your Alexa skill endpoint to your new URL
   - Test voice commands

3. **Check MongoDB**:
   - Verify data is being stored in MongoDB Atlas
   - Check logs for any connection issues

## 💰 Cost Comparison

| Platform | Free Tier | Limitations | Best For |
|----------|-----------|-------------|----------|
| **Render** | 750 hours/month | Sleeps after 15min | Personal use |
| **Railway** | $5/month credits | Credit-based | Active development |
| **Cyclic** | Generous limits | Serverless only | Always-on apps |
| **Fly.io** | 3 small VMs | 256MB RAM each | Performance apps |

## 📱 Alexa Configuration

After deployment, update your Alexa skill:

1. **Alexa Developer Console**:
   - Go to your skill's endpoint configuration
   - Update URL to: `https://your-deployed-app.com/api/alexa`
   - Save and build model

2. **Test**:
   - Use Alexa Simulator or your device
   - Try: "在庫管理を開いて" → "にんじんを3個追加した"

## 🚨 Troubleshooting

### App won't start:
- Check environment variables are set correctly
- Verify MongoDB URI is accessible
- Check platform logs

### MongoDB connection fails:
- Verify IP whitelist includes `0.0.0.0/0`
- Check username/password in connection string
- Ensure database user has proper permissions

### Alexa skill stops working:
- Verify HTTPS endpoint is accessible
- Check skill endpoint URL is updated
- Test with Postman/curl first

## 🎯 Recommendation

**For your private inventory tracker, use Render:**
- ✅ Completely free
- ✅ No public visibility 
- ✅ Easy MongoDB integration
- ✅ Perfect for personal Alexa skills
- ✅ Automatic HTTPS and domain
- ⚠️ Sleeps after 15min (wakes quickly on first request)

The sleep limitation is perfect for personal use - your Alexa skill will wake the app instantly when you use it!