require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// myPOS credentials - EXACT from configuration package
const MYPOS_WALLET_NUMBER = '40850018397';
const MYPOS_SID = '1223860';
const MYPOS_KEY_INDEX = '3';

const MYPOS_PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIICWwIBAAKBgQCWeAGt+IutRBfohdVtZuVxyCkO8MLVTTSjAnQ8qlWhLQXK+DA4
C+UVoLSx/TtWHz+MV+P2rL193H8UHob2dq2Wc2D6Cmoo6UqAe5KmklAO+v4VJHl9
FpAQyvH8SZtYAsV4j4RdA62TBQpqY6zlTF40XzIz6lRZBQkkblDKP/Nz9QIDAQAB
AoGAIbO5dJUB/AoPbNZlKn7sj2Ksx5rnmM0VKBnJnTjtuw8RiBe0/Si04/Y94sv8
eVrAahfZiIvCWamEkSYRRqzoTj2StJteagDikWawHVc4TPa8JgOHRH+zsCSzz4r0
gE5De+Z3PbhFjlLZyhTDk9kHu9H+4SMsM1aZqFvghHzN7tUCQQDIivRf8h+hchYe
QvY3KYO7GrwpMeFLWgwmRNgG+GTD7tWtogIRbl1vTYe9nCFP0p/40fJf8knknK1w
e8rgissnAkEAwBQoQ+wKMyJffreT5+ET4/FtCwXlBj3i33MUezXyRd7QDXJRd6y0
NXNF1krvMSI+078pWbzBR0wY2/LQOiHpgwJAVDq4pUvGqUKHs7IgQ871+zIhcZP3
snRhwfkMWvEdMYYwzTrMb5HRQJxptOPMwgAPHKzhhhb3nkOIPURhU6o35QJAc0Fl
K+SN9kLw5FuJn8EaK1Pp54xg8c7evNAUAR7MwopBc2AebF4wQEZsKHsMbgIriumR
CWzO2VZbMFfSBJ/muwJAcYzumJgGOpomv8OsDaBjyBW3sl3xCfwOWK1dKauQ5ADt
5YMfYBHxtJ2N5cedX0U54eLzCm2WGxABgGaLPWLcEQ==
-----END RSA PRIVATE KEY-----`;

const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
const MYPOS_CHECKOUT_URL = 'https://www.mypos.eu/vmp/checkout-test';

// Generate signature
function generateSignature(data) {
  try {
    // Step 1: Get all values in order (excluding Signature)
    const values = Object.values(data);
    
    // Step 2: Concatenate with dash
    const concatenated = values.join('-');
    
    // Step 3: Base64 encode
    const concData = Buffer.from(concatenated, 'utf8').toString('base64');
    
    // Step 4: Sign with private key using SHA256
    const sign = crypto.createSign('SHA256');
    sign.update(concData);
    sign.end();
    
    const signature = sign.sign(MYPOS_PRIVATE_KEY, 'base64');
    
    console.log('=== SIGNATURE GENERATION ===');
    console.log('Values:', values);
    console.log('Concatenated:', concatenated);
    console.log('Base64 data:', concData);
    console.log('Signature:', signature);
    
    return signature;
  } catch (error) {
    console.error('Signature generation error:', error);
    throw error;
  }
}

// Test endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'active',
    message: 'myPOS Payment Gateway',
    timestamp: new Date().toISOString()
  });
});

// Checkout endpoint
app.get('/checkout', (req, res) => {
  try {
    const amount = req.query.amount || '10.00';
    const currency = req.query.currency || 'EUR';
    const orderId = 'ORDER-' + Date.now();
    
    // Build payment data - EXACT ORDER MATTERS
    const paymentData = {
      IPCmethod: 'IPCPurchase',
      IPCVersion: '1.4',
      IPCLanguage: 'en',
      SID: MYPOS_SID,
      WalletNumber: MYPOS_WALLET_NUMBER,
      KeyIndex: MYPOS_KEY_INDEX,
      Amount: amount,
      Currency: currency,
      OrderID: orderId,
      URL_OK: `${APP_URL}/payment-success`,
      URL_Cancel: `${APP_URL}/payment-cancel`,
      URL_Notify: `${APP_URL}/payment-notify`,
      customeremail: 'test@example.com',
      customerfirstnames: 'Test',
      customerfamilyname: 'User',
      customerphone: '+31612345678',
      customercountry: 'NLD',
      customercity: 'Amsterdam',
      customerzipcode: '1012AB',
      customeraddress: 'Test Street 1'
    };
    
    console.log('\n=== CHECKOUT REQUEST ===');
    console.log('Payment Data:', JSON.stringify(paymentData, null, 2));
    
    // Generate signature
    const signature = generateSignature(paymentData);
    
    // Add signature as LAST parameter
    paymentData.Signature = signature;
    
    // Build form
    let formHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>Redirecting to myPOS...</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
            text-align: center;
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }
        .spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #667eea;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        h2 { color: #333; margin-bottom: 10px; }
        p { color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="spinner"></div>
        <h2>Redirecting to myPOS...</h2>
        <p>Please wait while we redirect you to the payment page.</p>
        <p style="font-size: 12px; color: #999; margin-top: 20px;">Order: ${orderId}</p>
        <p style="font-size: 12px; color: #999;">Amount: ${currency} ${amount}</p>
    </div>
    <form id="paymentForm" method="POST" action="${MYPOS_CHECKOUT_URL}">
`;

    // Add all form fields
    for (const [key, value] of Object.entries(paymentData)) {
      formHTML += `        <input type="hidden" name="${key}" value="${value}">\n`;
    }

    formHTML += `
    </form>
    <script>
        document.getElementById('paymentForm').submit();
    </script>
</body>
</html>`;

    res.send(formHTML);
    
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ 
      error: 'Failed to create checkout',
      message: error.message 
    });
  }
});

// Success page
app.get('/payment-success', (req, res) => {
  console.log('Payment success callback:', req.query);
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Payment Successful</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
            text-align: center;
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            max-width: 500px;
        }
        .success-icon {
            width: 80px;
            height: 80px;
            background: #4CAF50;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
            font-size: 40px;
            color: white;
        }
        h1 { color: #4CAF50; margin: 0 0 10px 0; }
        p { color: #666; margin: 10px 0; }
        .details {
            background: #f5f5f5;
            padding: 20px;
            border-radius: 5px;
            margin-top: 20px;
            text-align: left;
        }
        .details p { 
            margin: 5px 0; 
            font-family: monospace;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="success-icon">✓</div>
        <h1>Payment Successful!</h1>
        <p>Your payment has been processed successfully.</p>
        <div class="details">
            <p><strong>Order ID:</strong> ${req.query.OrderID || 'N/A'}</p>
            <p><strong>Amount:</strong> ${req.query.Currency || ''} ${req.query.Amount || 'N/A'}</p>
            <p><strong>Transaction:</strong> ${req.query.IPC_Trnref || 'N/A'}</p>
        </div>
    </div>
</body>
</html>
  `);
});

// Cancel page
app.get('/payment-cancel', (req, res) => {
  console.log('Payment cancelled:', req.query);
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Payment Cancelled</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
            text-align: center;
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }
        .cancel-icon {
            width: 80px;
            height: 80px;
            background: #f44336;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
            font-size: 40px;
            color: white;
        }
        h1 { color: #f44336; }
        p { color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="cancel-icon">✗</div>
        <h1>Payment Cancelled</h1>
        <p>Your payment was cancelled.</p>
        <p><a href="/checkout?amount=10.00&currency=EUR">Try again</a></p>
    </div>
</body>
</html>
  `);
});

// Notification endpoint
app.post('/payment-notify', (req, res) => {
  console.log('\n=== PAYMENT NOTIFICATION ===');
  console.log('Body:', req.body);
  
  // Respond with OK
  res.status(200).send('OK');
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 myPOS Payment Gateway running on port ${PORT}`);
  console.log(`\n📝 Configuration:`);
  console.log(`   - Wallet: ${MYPOS_WALLET_NUMBER}`);
  console.log(`   - SID: ${MYPOS_SID}`);
  console.log(`   - KeyIndex: ${MYPOS_KEY_INDEX}`);
  console.log(`   - Environment: TEST`);
  console.log(`\n🔗 Test URL: http://localhost:${PORT}/checkout?amount=10.00&currency=EUR`);
  console.log(`\n✅ Ready to process payments!`);
});
