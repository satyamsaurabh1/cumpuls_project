import crypto from 'crypto';
import User from '../models/User.js';
import Payment from '../models/Payment.js';
import { TOKEN_PACKAGES, tokenPackageMap } from '../config/tokenPackages.js';

const hasRazorpayConfig = () => {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
};

const createOrderWithRazorpay = async ({ amountInPaise, receipt, notes }) => {
  const authToken = Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
  ).toString('base64');

  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: amountInPaise,
      currency: 'INR',
      receipt,
      notes
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.description || 'Failed to create Razorpay order');
  }

  return payload;
};

const safeSignatureEqual = (left, right) => {
  if (!left || !right) return false;
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const getPackageFromWebhookPayload = (paymentEntity) => {
  const notePackageId = paymentEntity?.notes?.packageId;
  if (notePackageId && tokenPackageMap.has(notePackageId)) {
    return tokenPackageMap.get(notePackageId);
  }

  const matchedByAmount = TOKEN_PACKAGES.find(
    (item) => item.amountInPaise === Number(paymentEntity?.amount || 0)
  );
  return matchedByAmount || null;
};

export const getTokenPackages = async (req, res) => {
  res.json({
    packages: TOKEN_PACKAGES,
    checkoutReady: hasRazorpayConfig()
  });
};

export const createPaymentOrder = async (req, res) => {
  try {
    if (!hasRazorpayConfig()) {
      return res.status(500).json({
        message:
          'Razorpay is not configured on server. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.'
      });
    }

    const { packageId } = req.body;
    const selectedPackage = tokenPackageMap.get(packageId);

    if (!selectedPackage) {
      return res.status(400).json({ message: 'Invalid token package selected' });
    }

    // Razorpay receipt must be <= 40 chars.
    const shortUserId = req.user._id.toString().slice(-8);
    const shortTs = Date.now().toString(36);
    const receipt = `tok_${shortUserId}_${shortTs}`;
    const order = await createOrderWithRazorpay({
      amountInPaise: selectedPackage.amountInPaise,
      receipt,
      notes: {
        userId: req.user._id.toString(),
        packageId: selectedPackage.id,
        tokens: String(selectedPackage.tokens)
      }
    });

    res.json({
      orderId: order.id,
      amountInPaise: order.amount,
      currency: order.currency,
      package: selectedPackage,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Create payment order error:', error);
    res.status(500).json({ message: error.message || 'Unable to create payment order' });
  }
};

export const verifyPaymentAndAddTokens = async (req, res) => {
  try {
    if (!hasRazorpayConfig()) {
      return res.status(500).json({
        message:
          'Razorpay is not configured on server. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.'
      });
    }

    const { packageId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!packageId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: 'Missing required payment fields' });
    }

    const selectedPackage = tokenPackageMap.get(packageId);
    if (!selectedPackage) {
      return res.status(400).json({ message: 'Invalid token package selected' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const isValidSignature = safeSignatureEqual(expectedSignature, razorpay_signature);
    if (!isValidSignature) {
      return res.status(400).json({ message: 'Payment signature verification failed' });
    }

    try {
      await Payment.create({
        user: req.user._id,
        packageId: selectedPackage.id,
        tokens: selectedPackage.tokens,
        amountInPaise: selectedPackage.amountInPaise,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id
      });
    } catch (dbError) {
      if (dbError?.code === 11000) {
        return res.status(409).json({ message: 'Payment already verified for this transaction' });
      }
      throw dbError;
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $inc: { tokens: selectedPackage.tokens } },
      { new: true }
    ).select('tokens');

    res.json({
      message: 'Payment verified and tokens added',
      tokensAdded: selectedPackage.tokens,
      tokenBalance: user?.tokens || 0
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ message: 'Unable to verify payment' });
  }
};

export const handleRazorpayWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return res.status(500).json({
        message: 'Missing RAZORPAY_WEBHOOK_SECRET on server'
      });
    }

    const razorpaySignature = req.headers['x-razorpay-signature'];
    if (!razorpaySignature || !Buffer.isBuffer(req.body)) {
      return res.status(400).json({ message: 'Invalid webhook payload' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(req.body)
      .digest('hex');

    const isValid = safeSignatureEqual(expectedSignature, razorpaySignature);
    if (!isValid) {
      return res.status(400).json({ message: 'Invalid webhook signature' });
    }

    const event = JSON.parse(req.body.toString('utf8'));
    if (event?.event !== 'payment.captured') {
      return res.status(200).json({ message: 'Webhook received' });
    }

    const paymentEntity = event?.payload?.payment?.entity;
    const razorpayPaymentId = paymentEntity?.id;
    const razorpayOrderId = paymentEntity?.order_id;
    const userId = paymentEntity?.notes?.userId;

    if (!razorpayPaymentId || !razorpayOrderId || !userId) {
      return res.status(400).json({ message: 'Missing payment metadata in webhook' });
    }

    const selectedPackage = getPackageFromWebhookPayload(paymentEntity);
    if (!selectedPackage) {
      return res.status(400).json({ message: 'Unable to map payment to token package' });
    }

    const existingPayment = await Payment.findOne({ razorpayPaymentId });
    if (existingPayment) {
      return res.status(200).json({ message: 'Payment already processed' });
    }

    await Payment.create({
      user: userId,
      packageId: selectedPackage.id,
      tokens: selectedPackage.tokens,
      amountInPaise: selectedPackage.amountInPaise,
      razorpayOrderId,
      razorpayPaymentId
    });

    await User.findByIdAndUpdate(userId, { $inc: { tokens: selectedPackage.tokens } });

    return res.status(200).json({ message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('Razorpay webhook error:', error);
    return res.status(500).json({ message: 'Failed to process webhook' });
  }
};

export const getPaymentHistory = async (req, res) => {
  try {
    const payments = await Payment.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .select(
        'packageId tokens amountInPaise razorpayOrderId razorpayPaymentId createdAt updatedAt'
      );

    const history = payments.map((payment) => ({
      _id: payment._id,
      packageId: payment.packageId,
      tokens: payment.tokens,
      amountInPaise: payment.amountInPaise,
      razorpayOrderId: payment.razorpayOrderId,
      razorpayPaymentId: payment.razorpayPaymentId,
      status: 'completed',
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt
    }));

    return res.json({ history });
  } catch (error) {
    console.error('Get payment history error:', error);
    return res.status(500).json({ message: 'Unable to fetch payment history' });
  }
};
