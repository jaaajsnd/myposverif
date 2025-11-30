require('dotenv').config();
const express = require('express');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// myPOS SDK initialization
const mypos = require('@mypos-ltd/mypos')({
  isSandbox: true,
  logLevel: 'debug',
  checkout: {
    sid: '1223860',
    lang: 'EN',
    currency: 'EUR',
    clientNumber: '40850018397',
    okUrl: process.env.APP_URL ? `${process.env.APP_URL}/payment-success` : `http://localhost:${PORT}/payment-success`,
    cancelUrl: process.env.APP_URL ? `${process.env.APP_URL}/payment-cancel` : `http://localhost:${PORT}/payment-cancel`,
    notifyUrl: process.env.APP_URL ? `${process.env.APP_URL}/payment-notify` : `http://localhost:${PORT}/payment-notify`,
    keyIndex: 3,
    privateKey: `-----BEGIN RSA PRIVATE KEY-----
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
-----END RSA PRIVATE KEY-----`
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'active',
    message: 'myPOS Payment Gateway with Official SDK',
    timestamp: new Date().toISOString(),
    sdk: '@mypos-ltd/mypos'
  });
});

// Checkout endpoint
app.get('/checkout', (req, res) => {
  const amount = parseFloat(req.query.amount) || 10.00;
  const currency = req.query.currency || 'EUR';
  
  const purchaseParams = {
    orderId: uuidv4(),
    amount: amount,
    currency: currency,
    customer: {
      email: 'test@example.com',
      firstNames: 'Test',
      lastName: 'User',
      phone: '+31612345678',
      country: 'NLD',
      city: 'Amsterdam',
      zip: '1012AB',
      address: 'Test Street 1'
    }
  };

  console.log('\n=== CHECKOUT REQUEST (SDK) ===');
  console.log('Order ID:', purchaseParams.orderId);
  console.log('Amount:', amount, currency);
  
  mypos.checkout.purchase(purchaseParams, res);
});

// Success page
app.get('/payment-success', (req, res) => {
  console.log('\n=== PAYMENT SUCCESS ===');
  console.log('Query params:', req.query);
  
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
            <p><strong>Order ID:</strong> ${req.query.OrderID || req.query.orderId || 'N/A'}</p>
            <p><strong>Amount:</strong> ${req.query.Currency || req.query.currency || ''} ${req.query.Amount || req.query.amount || 'N/A'}</p>
            <p><strong>Transaction:</strong> ${req.query.IPC_Trnref || req.query.trnRef || 'N/A'}</p>
        </div>
    </div>
</body>
</html>
  `);
});

// Cancel page
app.get('/payment-cancel', (req, res) => {
  console.log('\n=== PAYMENT CANCELLED ===');
  console.log('Query params:', req.query);
  
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
        a {
            display: inline-block;
            margin-top: 20px;
            padding: 10px 20px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="cancel-icon">✗</div>
        <h1>Payment Cancelled</h1>
        <p>Your payment was cancelled.</p>
        <a href="/checkout?amount=10.00&currency=EUR">Try again</a>
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
  console.log(`\n🚀 myPOS Payment Gateway (Official SDK) running on port ${PORT}`);
  console.log(`\n📝 Configuration:`);
  console.log(`   - Wallet: 40850018397`);
  console.log(`   - SID: 1223860`);
  console.log(`   - KeyIndex: 3`);
  console.log(`   - Environment: SANDBOX`);
  console.log(`   - SDK: @mypos-ltd/mypos`);
  console.log(`\n🔗 Test URL: http://localhost:${PORT}/checkout?amount=10.00&currency=EUR`);
  console.log(`\n✅ Ready to process payments!`);
});
