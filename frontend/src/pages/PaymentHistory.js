import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../config/api';
import './PaymentHistory.css';

const formatInr = (amountInPaise) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format((amountInPaise || 0) / 100);

const formatDate = (value) =>
  new Date(value).toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

const PaymentHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await api.get('/payments/history');
        setHistory(response.data?.history || []);
      } catch (error) {
        toast.error(error?.response?.data?.message || 'Failed to load payment history');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  return (
    <div className="payment-history-page fade-in">
      <div className="payment-history-header">
        <h1>Payment History</h1>
        <p>Your completed token purchases</p>
      </div>

      {loading ? (
        <div className="payment-history-loading">Loading history...</div>
      ) : history.length === 0 ? (
        <div className="payment-history-empty">No payments found yet.</div>
      ) : (
        <div className="payment-history-table-wrap">
          <table className="payment-history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Package</th>
                <th>Tokens</th>
                <th>Amount</th>
                <th>Payment ID</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item._id}>
                  <td>{formatDate(item.createdAt)}</td>
                  <td>{item.packageId}</td>
                  <td>{item.tokens}</td>
                  <td>{formatInr(item.amountInPaise)}</td>
                  <td className="mono-cell">{item.razorpayPaymentId}</td>
                  <td>
                    <span className="status-completed">Completed</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PaymentHistory;
