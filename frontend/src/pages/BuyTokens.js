import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import api from '../config/api';
import { useAuth } from '../context/AuthContext';
import './BuyTokens.css';

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

const loadRazorpayScript = () => {
  if (window.Razorpay) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const existingScript = document.getElementById('razorpay-checkout-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.id = 'razorpay-checkout-script';
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const formatInr = (amountInPaise) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format((amountInPaise || 0) / 100);
};

const BuyTokens = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkoutReady, setCheckoutReady] = useState(false);
  const [processingPackageId, setProcessingPackageId] = useState('');
  const [lastPaymentId, setLastPaymentId] = useState('');

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const response = await api.get('/payments/packages');
        setPackages(response.data?.packages || []);
        setCheckoutReady(!!response.data?.checkoutReady);
      } catch (error) {
        toast.error(error?.response?.data?.message || 'Failed to load token packages');
      } finally {
        setLoading(false);
      }
    };

    fetchPackages();
  }, []);

  const handleVerificationResponse = async (packageId, paymentResult) => {
    const verificationResponse = await api.post('/payments/verify', {
      packageId,
      ...paymentResult
    });

    const newBalance = verificationResponse.data?.tokenBalance || 0;
    const addedTokens = verificationResponse.data?.tokensAdded || 0;
    const message = verificationResponse.data?.message || 'Payment verified successfully';
    const paymentId = paymentResult?.razorpay_payment_id || '';

    updateUser({ tokens: newBalance });
    setLastPaymentId(paymentId);
    toast.success(`${message}. ${addedTokens} tokens added. Payment ID: ${paymentId}`);
    toast.success('Payment completed. Redirecting to dashboard...');
    setTimeout(() => {
      navigate('/');
    }, 2000);
  };

  const handlePaymentFailed = (response) => {
    const description =
      response?.error?.description ||
      response?.error?.reason ||
      response?.error?.code ||
      'Payment failed. Please try again.';
    toast.error(description);
    setProcessingPackageId('');
  };

  const handleBuyTokens = async (packageId) => {
    setProcessingPackageId(packageId);

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast.error('Unable to load Razorpay checkout. Please try again.');
        return;
      }

      const orderResponse = await api.post('/payments/create-order', { packageId });
      const order = orderResponse.data;
      const razorpayKey = order.razorpayKeyId || process.env.REACT_APP_RAZORPAY_KEY_ID;

      if (!razorpayKey) {
        toast.error('Missing Razorpay key. Configure REACT_APP_RAZORPAY_KEY_ID.');
        return;
      }

      const razorpay = new window.Razorpay({
        key: razorpayKey,
        amount: order.amountInPaise,
        currency: order.currency,
        name: 'CreatorConnect',
        description: `${order.package.tokens} tokens`,
        order_id: order.orderId,
        prefill: {
          name: user?.name || '',
          email: user?.email || ''
        },
        theme: {
          color: '#0f766e'
        },
        modal: {
          ondismiss: () => setProcessingPackageId('')
        },
        handler: async (paymentResult) => {
          try {
            await handleVerificationResponse(packageId, paymentResult);
          } catch (verificationError) {
            toast.error(
              verificationError?.response?.data?.message || 'Payment verification failed'
            );
          } finally {
            setProcessingPackageId('');
          }
        }
      });

      razorpay.on('payment.failed', (response) => {
        handlePaymentFailed(response);
      });

      razorpay.open();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Unable to start payment');
      setProcessingPackageId('');
    }
  };

  return (
    <div className="buy-tokens-page fade-in">
      <div className="buy-tokens-header">
        <h1>Buy Tokens</h1>
        <p>Secure checkout powered by Razorpay</p>
        <div className="token-balance-badge">Current Balance: {user?.tokens || 0} tokens</div>
        <Link to="/payment-history" className="view-history-link">
          View Payment History
        </Link>
      </div>

      {lastPaymentId && (
        <div className="payment-success-box">
          Payment completed. Your payment ID is: <strong>{lastPaymentId}</strong>
        </div>
      )}

      {!checkoutReady && (
        <div className="payment-warning">
          Razorpay is not configured on server. Add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
        </div>
      )}

      {loading ? (
        <div className="payment-loader">Loading token packages...</div>
      ) : (
        <div className="token-packages-grid">
          {packages.map((tokenPackage) => (
            <div key={tokenPackage.id} className="token-package-card">
              <h3>{tokenPackage.label}</h3>
              <p className="token-count">{tokenPackage.tokens} tokens</p>
              <p className="token-price">{formatInr(tokenPackage.amountInPaise)}</p>
              <p className="token-description">{tokenPackage.description}</p>
              <button
                type="button"
                className="buy-token-btn"
                onClick={() => handleBuyTokens(tokenPackage.id)}
                disabled={!checkoutReady || !!processingPackageId}
              >
                {processingPackageId === tokenPackage.id ? 'Processing...' : 'Buy Now'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BuyTokens;
