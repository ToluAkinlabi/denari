'use client';

import { useState, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Card } from '@/components/card';
import { Loader, AlertCircle, CheckCircle, Building2, Trash2 } from 'lucide-react';
import {
  getPlaidConnectionStatus,
  createPlaidLinkToken,
  exchangePlaidPublicToken,
  syncPlaidTransactions,
} from '@/app/actions/plaid';

interface ConnectionStatus {
  connected: boolean;
  institutionName?: string;
}

export function SettingsBankConnection() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [syncing, setSyncing] = useState(false);

  // Load initial connection status
  useEffect(() => {
    async function loadStatus() {
      setLoading(true);
      try {
        const result = await getPlaidConnectionStatus();
        if (result.success && result.data) {
          setStatus(result.data);
        }
        setError('');
      } catch (err) {
        setError('Failed to load connection status');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadStatus();
  }, []);

  // Create Plaid link token when component mounts or when we need to reconnect
  const createToken = async () => {
    try {
      setError('');
      const result = await createPlaidLinkToken();
      if (result.success && result.data) {
        setLinkToken(result.data.linkToken);
      } else {
        setError(result.error || 'Failed to create link token');
      }
    } catch (err) {
      setError('Failed to create Plaid link token');
      console.error(err);
    }
  };

  // Plaid Link hook
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (publicToken, metadata) => {
      try {
        setLoading(true);
        setSyncStatus('Exchanging token...');

        // Exchange public token for access token
        const exchangeResult = await exchangePlaidPublicToken({
          publicToken,
          institutionName: metadata.institution?.name || 'Unknown Bank',
        });

        if (!exchangeResult.success) {
          setError(exchangeResult.error || 'Failed to exchange token');
          return;
        }

        setSyncStatus('Syncing transactions...');

        // Sync transactions
        const syncResult = await syncPlaidTransactions();

        if (syncResult.success && syncResult.data) {
          setSyncStatus(
            `✓ Synced! Added: ${syncResult.data.added}, Modified: ${syncResult.data.modified}, Removed: ${syncResult.data.removed}`
          );
        } else {
          setError(syncResult.error || 'Sync failed');
        }

        // Reload status
        const newStatusResult = await getPlaidConnectionStatus();
        if (newStatusResult.success && newStatusResult.data) {
          setStatus(newStatusResult.data);
        }

        setLinkToken(null);
      } catch (err) {
        setError('Failed to complete bank connection');
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    onExit: () => {
      setLinkToken(null);
    },
  });

  // Trigger link opening when ready and link token exists
  useEffect(() => {
    if (ready && linkToken && open) {
      open();
    }
  }, [ready, linkToken, open]);

  const handleConnectBank = async () => {
    await createToken();
  };

  const handleReconnect = async () => {
    await createToken();
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncStatus('Syncing...');
    try {
      const result = await syncPlaidTransactions();
      if (result.success && result.data) {
        setSyncStatus(
          `✓ Synced! Added: ${result.data.added}, Modified: ${result.data.modified}, Removed: ${result.data.removed}`
        );
      } else {
        setSyncStatus(result.error || 'Sync failed');
      }
    } catch (err) {
      setSyncStatus('Sync failed');
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    // TODO: Implement disconnect functionality
    // For now, this is a placeholder
    alert('Disconnect functionality coming soon');
  };

  if (loading && status === null) {
    return (
      <div>
        <h3 className="text-sm font-semibold mb-2 text-muted uppercase">Bank Connection</h3>
        <Card className="p-4">
          <div className="flex items-center justify-center py-6">
            <Loader className="animate-spin text-gray-400" size={20} />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold mb-2 text-muted uppercase">Bank Connection</h3>
      <Card className="p-4">
        {/* Status Section */}
        <div className="py-3 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            {status?.connected ? (
              <>
                <CheckCircle size={20} className="text-green-600 dark:text-green-400" />
                <div>
                  <p className="font-medium">Connected to {status.institutionName}</p>
                  <p className="text-xs text-muted">Automatic sync active</p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle size={20} className="text-gray-600 dark:text-gray-400" />
                <div>
                  <p className="font-medium">Not Connected</p>
                  <p className="text-xs text-muted">Connect your bank account to sync transactions</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="py-3 px-3 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-200 rounded text-sm border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        {/* Sync Status Message */}
        {syncStatus && (
          <div
            className={`py-3 px-3 rounded text-sm border ${
              syncStatus.startsWith('✓')
                ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-200 border-green-200 dark:border-green-800'
                : 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-200 border-blue-200 dark:border-blue-800'
            }`}
          >
            {syncStatus}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-3">
          {!status?.connected ? (
            <button
              onClick={handleConnectBank}
              disabled={loading}
              className="flex-1 py-2 px-3 bg-blue-600 dark:bg-blue-700 text-white rounded font-medium text-sm hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Building2 size={16} />
                  Connect Bank
                </>
              )}
            </button>
          ) : (
            <>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex-1 py-2 px-3 bg-green-600 dark:bg-green-700 text-white rounded font-medium text-sm hover:bg-green-700 dark:hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {syncing ? (
                  <>
                    <Loader size={16} className="animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <Building2 size={16} />
                    Sync Now
                  </>
                )}
              </button>
              <button
                onClick={handleReconnect}
                className="py-2 px-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded font-medium text-sm hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Change
              </button>
              <button
                onClick={handleDisconnect}
                className="py-2 px-3 bg-gray-200 dark:bg-gray-700 text-red-600 dark:text-red-400 rounded font-medium text-sm hover:bg-gray-300 dark:hover:bg-gray-600"
                title="Disconnect bank account"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
