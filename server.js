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

// myPOS credentials
const MYPOS_WALLET_NUMBER = process.env.MYPOS_WALLET_NUMBER || '40850018397';
const MYPOS_SID = process.env.MYPOS_SID || '1223860';
const MYPOS_PRIVATE_KEY = process.env.MYPOS_PRIVATE_KEY || `-----BEGIN RSA PRIVATE KEY-----
MIICXQIBAAKBgQDbuaIW2qeoMllUjkl+VSyzqVnS+BdF6jniPY8Mst9ke0f7zBez
6O6/TldggWolZA9tEX2QdUNathBYrDRH8XB1P0iuO3c3h3Jpsnoa1t+Ttybhc7Zi
/eyMVPIetJMl3EIShmtLv8IbiMcez7FfVvZifoqj6/xaSfsdMKfKEaEKQQIDAQAB
AoGBAMsYhhN73pagm2OF9ba5Qg17DtTrjo+IViKh5fTF7akyLrI2zv3z46Ke5jME
zDltiLi2/wok6bISMX/VBKovKFLxQBVfGBb9fMGFMIkjEIpFRwNIb20LzKXRGuSW
y0kTo6V3hRPfS42Iv9kr+zNTz0cBcKWnwq/B9PbxN+fYvhcFAkEA8PjpdV8r5cvF
RqqCYhDJKCDQgcZTtzm/SvJ8nhakBA50NHH7QSZrNPzMx0vbibqaeB/T8ucF81uV
jcNfCBXJ/wJBAOltg1VBz5cAn29FlKESkjFV8bVnxcNzuH0q3vTk6nxJZzU40CPe
jb6UlBHErwRZ3OyIx1vOWvmIjr1OOZCOq78CQAkiJhcgyFUpaAzJoa9922H9/Gku
zzV+ptV8Y2TKjuTod1cViuRpRF75xfk30tZhkEFFU489Wmhi7EQ3R37S9JkCQQDD
eFFiM5oCeSMJqtqrh0GkzrN5lUymP2Feb2gE6yzwpwcmKk0hvFw2G3Vi67Ejk5zM
9jz7Q/Iqw4/ENp090DtBAkAISWGt/ws36DMdSE6tloVg058mcsr66i3pI9GjpMek
VEOnkC+KoIcN51kF0T2xyjS5kcUqFwiRtGrznh1oXAum
-----END RSA PRIVATE KEY-----`;

const MYPOS_PUBLIC_CERT = process.env.MYPOS_PUBLIC_CERT || `-----BEGIN CERTIFICATE-----
MIICDTCCAXagAwIBAgIEK0FGcTANBgkqhkiG9w0BAQsFADAdMQswCQYDVQQGEwJC
RzEOMAwGA1UEChMFbXlQT1MwHhcNMjUxMTI4MTIwOTM5WhcNMzUxMTI2MTIwOTM5
WjAdMQswCQYDVQQGEwJCRzEOMAwGA1UEChMFbXlQT1MwgZ8wDQYJKoZIhvcNAQEB
BQADgY0AMIGJAoGBANHWhjFQb/irLRsJ9MqNDaUQNHgH/Ryz+mB1jHrx6BlVvfrY
kyi4UBhpf8/q3CS5xcm8LxAnT+FnuzEiz8lw8JzhEFhSqk/HgC2iFPNi2XAKV7Oj
PnFgEjX3jZSVAp/FBx7s1B0llrnJGEZjVmH/2RKUSDOooDbYlat/9EEZOPbLAgMB
AAGjWjBYMB0GA1UdDgQWBBQ3YYdmjjgliEr23V+9sV8jbzrWAjAfBgNVHSMEGDAW
gBQ3YYdmjjgliEr23V+9sV8jbzrWAjAJBgNVHRMEAjAAMAsGA1UdDwQEAwIE8DAN
BgkqhkiG9w0BAQsFAAOBgQBngFbfopxqTZkEj8dYdgPnbgjb+B0GRlYPtO/3QI7j
Bw7kRzr+8CaueZDPABlfLqZ0y7+Xkzv/NxWiKf6fX8KEA4P/dKRccwExt/hRSgQn
uvJ1XTQAcLZPEUJoclHXPpZfF3Eapt+pIAmeduK9278ngSyeDhu6EoVC5LwVG0i+
WQ==
-----END CERTIFICATE-----`;

const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
const MYPOS_CHECKOUT_URL = process.env.MYPOS_CHECKOUT_URL || 'https://www.mypos.eu/vmp/checkout-test';

// In-memory storage voor orders
const pendingOrders = new Map();

// Helper function to create signature
function createSignature(data) {
  // Step 1: Concatenate all values with dash separator
  const values = Object.values(data);
  const concatenated = values.join('-');
  
  // Step 2: Base64 encode the concatenated string
  const concData = Buffer.from(concatenated, 'utf8').toString('base64');
  
  // Step 3: Sign the base64 encoded data with private key using SHA256
  const sign = crypto.createSign('SHA256');
  sign.update(concData);
  sign.end();
  
  // Step 4: Base64 encode the signature
  const signature = sign.sign(MYPOS_PRIVATE_KEY, 'base64');
  
  console.log('Signature Debug:');
  console.log('- Values:', values);
  console.log('- Concatenated:', concatenated);
  console.log('- Base64 data:', concData);
  console.log('- Signature:', signature);
  
  return signature;
}

// Helper function to verify signature from myPOS
function verifySignature(data, signature) {
  try {
    // Remove signature from data
    const dataWithoutSignature = { ...data };
    delete dataWithoutSignature.Signature;
    
    // Step 1: Concatenate all values with dash separator
    const values = Object.values(dataWithoutSignature);
    const concatenated = values.join('-');
    
    // Step 2: Base64 encode the concatenated string
    const concData = Buffer.from(concatenated, 'utf8').toString('base64');
    
    // Step 3: Verify signature
    const verify = crypto.createVerify('SHA256');
    verify.update(concData);
    verify.end();
    
    const isValid = verify.verify(MYPOS_PUBLIC_CERT, signature, 'base64');
    
    console.log('Verification Debug:');
    console.log('- Values:', values);
    console.log('- Concatenated:', concatenated);
    console.log('- Base64 data:', concData);
    console.log('- Is valid:', isValid);
    
    return isValid;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// Test endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'active',
    message: 'Shopify-myPOS Payment Gateway is running',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Checkout pagina
app.get('/checkout', async (req, res) => {
  const { amount, currency, order_id, return_url, cart_items } = req.query;
  
  if (!amount || !currency) {
    return res.status(400).send('Verplichte parameters ontbreken: bedrag en valuta');
  }

  // Parse cart items if provided
  let cartData = null;
  if (cart_items) {
    try {
      cartData = JSON.parse(decodeURIComponent(cart_items));
      console.log('Cart data ontvangen:', cartData);
    } catch (e) {
      console.error('Error parsing cart_items:', e);
    }
  }

  res.send(`
    <html>
      <head>
        <title>Afrekenen - €${amount}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          * { 
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
            background: #f7f7f7;
            color: #333;
            line-height: 1.6;
          }
          .checkout-container {
            display: flex;
            min-height: 100vh;
          }
          
          .order-summary {
            width: 50%;
            background: #fafafa;
            padding: 60px 80px;
            border-right: 1px solid #e1e1e1;
          }
          .logo {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 40px;
            color: #000;
          }
          .cart-items {
            margin-bottom: 30px;
          }
          .cart-item {
            display: flex;
            gap: 15px;
            margin-bottom: 20px;
            padding-bottom: 20px;
            border-bottom: 1px solid #e1e1e1;
          }
          .cart-item:last-child {
            border-bottom: none;
          }
          .item-image {
            width: 64px;
            height: 64px;
            background: #e1e1e1;
            border-radius: 8px;
            position: relative;
          }
          .item-quantity {
            position: absolute;
            top: -8px;
            right: -8px;
            background: #717171;
            color: white;
            width: 22px;
            height: 22px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 600;
          }
          .item-details {
            flex: 1;
          }
          .item-name {
            font-weight: 500;
            font-size: 14px;
            margin-bottom: 4px;
          }
          .item-variant {
            font-size: 13px;
            color: #717171;
          }
          .item-price {
            font-weight: 500;
            font-size: 14px;
          }
          .summary-section {
            padding: 20px 0;
            border-top: 1px solid #e1e1e1;
          }
          .summary-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 12px;
            font-size: 14px;
          }
          .summary-row.total {
            font-size: 18px;
            font-weight: 600;
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px solid #e1e1e1;
          }
          
          .payment-form {
            width: 50%;
            background: white;
            padding: 60px 80px;
          }
          .breadcrumb {
            font-size: 13px;
            color: #717171;
            margin-bottom: 30px;
          }
          .breadcrumb a {
            color: #2c6ecb;
            text-decoration: none;
          }
          .section {
            margin-bottom: 30px;
          }
          .section-title {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 16px;
          }
          .form-group {
            margin-bottom: 12px;
          }
          label {
            display: block;
            font-size: 13px;
            font-weight: 500;
            margin-bottom: 6px;
            color: #333;
          }
          input {
            width: 100%;
            padding: 12px 14px;
            border: 1px solid #d9d9d9;
            border-radius: 5px;
            font-size: 14px;
            font-family: inherit;
            transition: border 0.2s;
          }
          input:focus {
            outline: none;
            border-color: #2c6ecb;
            box-shadow: 0 0 0 3px rgba(44, 110, 203, 0.1);
          }
          .form-row {
            display: flex;
            gap: 12px;
          }
          .form-row .form-group {
            flex: 1;
          }
          
          .pay-button {
            width: 100%;
            padding: 18px;
            background: #2c6ecb;
            color: white;
            border: none;
            border-radius: 5px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            margin-top: 24px;
            transition: background 0.2s;
          }
          .pay-button:hover {
            background: #1f5bb5;
          }
          .pay-button:disabled {
            background: #d9d9d9;
            cursor: not-allowed;
          }
          
          .secure-badge {
            text-align: center;
            color: #717171;
            font-size: 12px;
            margin-top: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
          }
          .error {
            background: #fff4f4;
            border: 1px solid #ffcdd2;
            color: #c62828;
            padding: 12px 16px;
            border-radius: 5px;
            margin: 16px 0;
            display: none;
            font-size: 14px;
          }
          
          @media (max-width: 1000px) {
            .checkout-container {
              flex-direction: column-reverse;
            }
            .order-summary,
            .payment-form {
              width: 100%;
              padding: 30px 20px;
            }
            .order-summary {
              border-right: none;
              border-top: 1px solid #e1e1e1;
            }
          }
        </style>
      </head>
      <body>
        <div class="checkout-container">
          <div class="order-summary">
            <div class="cart-items" id="cart-items">
            </div>
            
            <div class="summary-section">
              <div class="summary-row">
                <span>Subtotaal</span>
                <span id="subtotal">€${amount}</span>
              </div>
              <div class="summary-row">
                <span>Verzending</span>
                <span>Gratis</span>
              </div>
              <div class="summary-row total">
                <span>Totaal</span>
                <span>EUR <strong id="total">€${amount}</strong></span>
              </div>
            </div>
          </div>
          
          <div class="payment-form">
            <div class="breadcrumb">
              <a href="#">Winkelwagen</a> › <a href="#">Informatie</a> › <strong>Betaling</strong>
            </div>
            
            <div id="error-message" class="error"></div>
            
            <form id="payment-form" method="POST" action="/api/create-payment">
              <div class="section">
                <div class="section-title">Contact</div>
                
                <div class="form-group">
                  <label for="email">E-mailadres</label>
                  <input type="email" name="email" id="email" placeholder="jan@voorbeeld.nl" required>
                </div>
              </div>
              
              <div class="section">
                <div class="section-title">Bezorgadres</div>
                
                <div class="form-row">
                  <div class="form-group">
                    <label for="firstName">Voornaam</label>
                    <input type="text" name="firstName" id="firstName" placeholder="Jan" required>
                  </div>
                  <div class="form-group">
                    <label for="lastName">Achternaam</label>
                    <input type="text" name="lastName" id="lastName" placeholder="Jansen" required>
                  </div>
                </div>
                
                <div class="form-group">
                  <label for="address">Adres</label>
                  <input type="text" name="address" id="address" placeholder="Hoofdstraat 123" required>
                </div>
                
                <div class="form-row">
                  <div class="form-group">
                    <label for="postalCode">Postcode</label>
                    <input type="text" name="postalCode" id="postalCode" placeholder="1234 AB" required>
                  </div>
                  <div class="form-group">
                    <label for="city">Plaats</label>
                    <input type="text" name="city" id="city" placeholder="Amsterdam" required>
                  </div>
                </div>
                
                <div class="form-group">
                  <label for="phone">Telefoon (optioneel)</label>
                  <input type="tel" name="phone" id="phone" placeholder="+31612345678">
                </div>
              </div>

              <input type="hidden" name="amount" value="${amount}">
              <input type="hidden" name="currency" value="${currency}">
              <input type="hidden" name="orderId" value="${order_id || ''}">
              <input type="hidden" name="returnUrl" value="${return_url || APP_URL}">
              <input type="hidden" name="cartData" value="${cartData ? encodeURIComponent(JSON.stringify(cartData)) : ''}">

              <button type="submit" class="pay-button">
                Doorgaan naar betaling
              </button>
            </form>
            
            <div class="secure-badge">
              <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor">
                <path d="M6 0L0 2v5c0 3.7 2.5 7.1 6 8 3.5-.9 6-4.3 6-8V2L6 0zm0 12.9c-2.9-.8-5-3.7-5-6.9V3.1l5-1.7 5 1.7v2.9c0 3.2-2.1 6.1-5 6.9z"/>
              </svg>
              Alle transacties zijn beveiligd en versleuteld
            </div>
          </div>
        </div>

        <script>
          const cartData = ${cartData ? JSON.stringify(cartData) : 'null'};

          function displayCartItems() {
            const container = document.getElementById('cart-items');
            if (!cartData || !cartData.items) {
              container.innerHTML = '<p style="color: #717171;">Geen producten</p>';
              return;
            }
            
            container.innerHTML = cartData.items.map(item => \`
              <div class="cart-item">
                <div class="item-image">
                  <div class="item-quantity">\${item.quantity}</div>
                </div>
                <div class="item-details">
                  <div class="item-name">\${item.title || item.product_title}</div>
                  <div class="item-variant">\${item.variant_title || ''}</div>
                </div>
                <div class="item-price">€\${(item.price / 100).toFixed(2)}</div>
              </div>
            \`).join('');
          }

          displayCartItems();
        </script>
      </body>
    </html>
  `);
});

// Create myPOS payment (POST form)
app.post('/api/create-payment', (req, res) => {
  try {
    const { 
      amount, 
      currency, 
      orderId, 
      returnUrl, 
      cartData,
      email,
      firstName,
      lastName,
      address,
      postalCode,
      city,
      phone
    } = req.body;
    
    console.log('Creating myPOS payment:', { amount, currency, orderId });

    // Parse cart data
    let parsedCartData = null;
    if (cartData) {
      try {
        parsedCartData = JSON.parse(decodeURIComponent(cartData));
      } catch (e) {
        console.error('Error parsing cart data:', e);
      }
    }

    // Prepare cart items for myPOS
    let cartItems = [];
    let cartItemsCount = 0;
    
    if (parsedCartData && parsedCartData.items) {
      cartItems = parsedCartData.items.map((item, index) => {
        const itemIndex = index + 1;
        const itemPrice = (item.price / 100).toFixed(2);
        const itemAmount = ((item.price * item.quantity) / 100).toFixed(2);
        
        return {
          [`Article_${itemIndex}`]: item.title || item.product_title,
          [`Quantity_${itemIndex}`]: item.quantity,
          [`Price_${itemIndex}`]: itemPrice,
          [`Currency_${itemIndex}`]: currency.toUpperCase(),
          [`Amount_${itemIndex}`]: itemAmount
        };
      });
      cartItemsCount = parsedCartData.items.length;
    } else {
      // Default single item
      cartItems = [{
        'Article_1': 'Order',
        'Quantity_1': 1,
        'Price_1': parseFloat(amount).toFixed(2),
        'Currency_1': currency.toUpperCase(),
        'Amount_1': parseFloat(amount).toFixed(2)
      }];
      cartItemsCount = 1;
    }

    const generatedOrderId = orderId || `ORDER-${Date.now()}`;
    
    // Build payment data in correct order for signature
    const paymentData = {
      IPCmethod: 'IPCPurchase',
      IPCVersion: '1.4',
      IPCLanguage: 'EN',
      SID: MYPOS_SID,
      WalletNumber: MYPOS_WALLET_NUMBER,
      Amount: parseFloat(amount).toFixed(2),
      Currency: currency.toUpperCase(),
      OrderID: generatedOrderId,
      URL_OK: `${APP_URL}/payment/success?order_id=${generatedOrderId}&return_url=${encodeURIComponent(returnUrl)}`,
      URL_Cancel: `${APP_URL}/payment/cancel?order_id=${generatedOrderId}&return_url=${encodeURIComponent(returnUrl)}`,
      URL_Notify: `${APP_URL}/webhook/mypos`,
      CardTokenRequest: '0',
      KeyIndex: '2',
      PaymentParametersRequired: '1',
      customeremail: email,
      customerfirstnames: firstName,
      customerfamilyname: lastName,
      customerphone: phone || '',
      customercountry: 'NLD',
      customercity: city,
      customerzipcode: postalCode,
      customeraddress: address,
      Note: '',
      CartItems: cartItemsCount
    };

    // Add cart items to payment data
    cartItems.forEach(item => {
      Object.assign(paymentData, item);
    });

    // Create signature (signature is last parameter)
    const signature = createSignature(paymentData);
    paymentData.Signature = signature;

    // Store order info
    pendingOrders.set(generatedOrderId, {
      amount,
      currency,
      customerData: { email, firstName, lastName, address, postalCode, city, phone },
      cartData: parsedCartData,
      returnUrl,
      created_at: new Date()
    });

    console.log('Payment data prepared:', { orderId: generatedOrderId, amount, currency });

    // Generate HTML form that auto-submits to myPOS
    const formFields = Object.entries(paymentData)
      .map(([key, value]) => `<input type="hidden" name="${key}" value="${value}">`)
      .join('\n');

    res.send(`
      <html>
        <head>
          <title>Doorsturen naar myPOS...</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              padding: 50px;
              background: #f5f5f5;
            }
            .box {
              background: white;
              padding: 40px;
              border-radius: 10px;
              max-width: 500px;
              margin: 0 auto;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .spinner {
              border: 4px solid #f3f3f3;
              border-top: 4px solid #2c6ecb;
              border-radius: 50%;
              width: 40px;
              height: 40px;
              animation: spin 1s linear infinite;
              margin: 20px auto;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            h1 { color: #333; }
            p { color: #666; }
          </style>
        </head>
        <body>
          <div class="box">
            <div class="spinner"></div>
            <h1>Doorsturen naar betaling...</h1>
            <p>Een moment geduld, je wordt doorgestuurd naar de beveiligde betaalpagina.</p>
          </div>
          
          <form id="mypos-form" method="POST" action="${MYPOS_CHECKOUT_URL}">
            ${formFields}
          </form>
          
          <script>
            document.getElementById('mypos-form').submit();
          </script>
        </body>
      </html>
    `);

  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).send(`
      <html>
        <head><title>Fout</title></head>
        <body>
          <h1>Er is een fout opgetreden</h1>
          <p>${error.message}</p>
          <a href="/">Terug naar home</a>
        </body>
      </html>
    `);
  }
});

// Payment success page
app.get('/payment/success', (req, res) => {
  const { order_id, return_url } = req.query;
  
  res.send(`
    <html>
      <head>
        <title>Betaling Geslaagd</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 50px;
            background: #f5f5f5;
          }
          .box {
            background: white;
            padding: 40px;
            border-radius: 10px;
            max-width: 500px;
            margin: 0 auto;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .success {
            color: #4caf50;
            font-size: 48px;
            margin-bottom: 20px;
          }
          h1 { color: #333; }
          p { color: #666; }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background: #2c6ecb;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="box">
          <div class="success">✓</div>
          <h1>Betaling Geslaagd!</h1>
          <p>Je betaling is succesvol verwerkt.</p>
          <p><strong>Order ID:</strong> ${order_id}</p>
          <a href="${return_url || '/'}" class="button">Terug naar winkel</a>
        </div>
      </body>
    </html>
  `);
});

// Payment cancel page
app.get('/payment/cancel', (req, res) => {
  const { order_id, return_url } = req.query;
  
  res.send(`
    <html>
      <head>
        <title>Betaling Geannuleerd</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 50px;
            background: #f5f5f5;
          }
          .box {
            background: white;
            padding: 40px;
            border-radius: 10px;
            max-width: 500px;
            margin: 0 auto;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .warning {
            color: #ff9800;
            font-size: 48px;
            margin-bottom: 20px;
          }
          h1 { color: #333; }
          p { color: #666; }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background: #2c6ecb;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="box">
          <div class="warning">⚠</div>
          <h1>Betaling Geannuleerd</h1>
          <p>Je betaling is geannuleerd. Je kunt opnieuw proberen als je wilt.</p>
          <a href="${return_url || '/'}" class="button">Terug naar winkel</a>
        </div>
      </body>
    </html>
  `);
});

// Webhook endpoint for myPOS
app.post('/webhook/mypos', (req, res) => {
  try {
    console.log('myPOS webhook received:', req.body);
    
    const signature = req.body.Signature;
    
    // Verify signature
    if (!verifySignature(req.body, signature)) {
      console.error('Invalid signature from myPOS');
      return res.status(400).send('Invalid signature');
    }
    
    const { IPCmethod, OrderID, Amount, Currency, Status, StatusMsg } = req.body;
    
    console.log('Payment notification:', { 
      method: IPCmethod, 
      orderId: OrderID, 
      amount: Amount, 
      currency: Currency, 
      status: Status, 
      message: StatusMsg 
    });
    
    if (IPCmethod === 'IPCPurchaseNotify' && Status === '0') {
      console.log('✅ Payment successful:', OrderID);
      
      // Here you could create a Shopify order or update your database
      const orderInfo = pendingOrders.get(OrderID);
      if (orderInfo) {
        console.log('Order info found:', orderInfo);
        // Process the successful payment
      }
    } else if (IPCmethod === 'IPCPurchaseCancel') {
      console.log('❌ Payment cancelled:', OrderID);
    } else if (IPCmethod === 'IPCPurchaseRollback') {
      console.log('↩️ Payment rollback:', OrderID);
    }
    
    // Always respond with OK
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(200).send('OK'); // Still respond OK to prevent retries
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 App URL: ${APP_URL}`);
  console.log(`✅ myPOS configured:`);
  console.log(`   - Wallet: ${MYPOS_WALLET_NUMBER}`);
  console.log(`   - SID: ${MYPOS_SID}`);
  console.log(`🔗 Checkout URL: ${APP_URL}/checkout`);
  console.log(`🔗 Webhook URL: ${APP_URL}/webhook/mypos`);
});
