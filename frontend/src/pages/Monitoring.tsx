import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Server, Database, HardDrive, Activity, AlertTriangle, CheckCircle, Clock, TrendingUp, RefreshCw, Zap, Timer, AlertCircle } from 'lucide-react';
import api from '../api/axios';

interface SystemMetrics {
  uptime: string;
  cpu_usage: number;
  memory_usage: number;
  memory_total: number;
  disk_usage: number;
  disk_total: number;
  db_connections: number;
  db_max_connections: number;
  api_requests_per_min: number;
  api_avg_response_ms: number;
  api_error_rate: number;
  orders_today: number;
  orders_total: number;
  active_sessions: number;
  last_backup: string;
  status: 'healthy' | 'warning' | 'critical';
}

interface APIMetrics {
  total_requests: number;
  error_count: number;
  error_rate: number;
  uptime: string;
  requests_per_min: number;
  avg_response_ms: number;
  p50_response_ms: number;
  p95_response_ms: number;
  p99_response_ms: number;
  min_response_ms: number;
  max_response_ms: number;
  status_codes: Record<string, number>;
}

export default function Monitoring() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [apiMetrics, setAPIMetrics] = useState<APIMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await api.get('/api/system/metrics');
      if (res.data) {
        setMetrics(res.data.metrics || res.data);
        setAPIMetrics(res.data.api_metrics || null);
      }
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch metrics', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [fetchMetrics, autoRefresh]);

  if (user?.role !== 'admin' && user?.role !== 'super_admin') {
    navigate('/dashboard');
    return null;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-emerald-500';
      case 'warning': return 'bg-amber-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'healthy': return 'All systems operational';
      case 'warning': return 'Some systems need attention';
      case 'critical': return 'Critical issues detected';
      default: return 'Unknown';
    }
  };

  const getUsageColor = (percent: number) => {
    if (percent >= 90) return 'text-red-600';
    if (percent >= 70) return 'text-amber-600';
    return 'text-emerald-600';
  };

  const getUsageBg = (percent: number) => {
    if (percent >= 90) return 'bg-red-500';
    if (percent >= 70) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  if (loading && !metrics) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-3" />
            <p className="text-gray-500">Loading system metrics...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Monitoring</h1>
          <p className="text-sm text-gray-500 mt-1">
            {lastUpdated && `Last updated: ${lastUpdated.toLocaleTimeString()}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchMetrics}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 ${
              autoRefresh 
                ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Clock className="w-4 h-4" />
            Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Status Banner */}
      {metrics && (
        <div className={`p-4 rounded-xl border ${
          metrics.status === 'healthy' ? 'bg-emerald-50 border-emerald-200' :
          metrics.status === 'warning' ? 'bg-amber-50 border-amber-200' :
          'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${getStatusColor(metrics.status)} animate-pulse`} />
            <div>
              <p className={`font-medium ${
                metrics.status === 'healthy' ? 'text-emerald-800' :
                metrics.status === 'warning' ? 'text-amber-800' :
                'text-red-800'
              }`}>
                {getStatusText(metrics.status)}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Uptime: {metrics.uptime}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* System Resources */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CPU */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <Server className="w-5 h-5 text-indigo-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">CPU Usage</span>
            </div>
            {metrics && (
              <span className={`text-lg font-bold ${getUsageColor(metrics.cpu_usage)}`}>
                {metrics.cpu_usage}%
              </span>
            )}
          </div>
          {metrics && (
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-500 ${getUsageBg(metrics.cpu_usage)}`}
                style={{ width: `${Math.min(metrics.cpu_usage, 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* Memory */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-50 rounded-lg">
                <HardDrive className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Memory</span>
            </div>
            {metrics && (
              <span className={`text-lg font-bold ${getUsageColor(metrics.memory_usage)}`}>
                {metrics.memory_usage}%
              </span>
            )}
          </div>
          {metrics && (
            <>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-500 ${getUsageBg(metrics.memory_usage)}`}
                  style={{ width: `${Math.min(metrics.memory_usage, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {((metrics.memory_usage / 100) * metrics.memory_total).toFixed(1)} GB / {metrics.memory_total} GB
              </p>
            </>
          )}
        </div>

        {/* Disk */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Database className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Disk</span>
            </div>
            {metrics && (
              <span className={`text-lg font-bold ${getUsageColor(metrics.disk_usage)}`}>
                {metrics.disk_usage}%
              </span>
            )}
          </div>
          {metrics && (
            <>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-500 ${getUsageBg(metrics.disk_usage)}`}
                  style={{ width: `${Math.min(metrics.disk_usage, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {((metrics.disk_usage / 100) * metrics.disk_total).toFixed(1)} GB / {metrics.disk_total} GB
              </p>
            </>
          )}
        </div>

        {/* DB Connections */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <Activity className="w-5 h-5 text-emerald-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">DB Connections</span>
            </div>
            {metrics && (
              <span className={`text-lg font-bold ${getUsageColor((metrics.db_connections / metrics.db_max_connections) * 100)}`}>
                {metrics.db_connections}/{metrics.db_max_connections}
              </span>
            )}
          </div>
          {metrics && (
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-500 ${getUsageBg((metrics.db_connections / metrics.db_max_connections) * 100)}`}
                style={{ width: `${Math.min((metrics.db_connections / metrics.db_max_connections) * 100, 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* API & Business Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* API Requests/min */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500">API Requests/min</span>
            <Zap className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {apiMetrics ? Math.round(apiMetrics.requests_per_min) : (metrics?.api_requests_per_min || '--')}
          </p>
        </div>

        {/* Avg Response Time */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500">Avg Response</span>
            <Timer className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {apiMetrics ? `${Math.round(apiMetrics.avg_response_ms)}ms` : (metrics ? `${metrics.api_avg_response_ms}ms` : '--')}
          </p>
        </div>

        {/* Error Rate */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500">Error Rate</span>
            {(apiMetrics && apiMetrics.error_rate > 5) || (metrics && metrics.api_error_rate > 5) ? (
              <AlertCircle className="w-4 h-4 text-red-500" />
            ) : (
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            )}
          </div>
          <p className={`text-2xl font-bold ${
            (apiMetrics && apiMetrics.error_rate > 5) || (metrics && metrics.api_error_rate > 5) ? 'text-red-600' : 'text-gray-900'
          }`}>
            {apiMetrics ? `${Math.round(apiMetrics.error_rate * 10) / 10}%` : (metrics ? `${metrics.api_error_rate}%` : '--')}
          </p>
        </div>

        {/* Orders Today */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500">Orders Today</span>
            <TrendingUp className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {metrics ? metrics.orders_today : '--'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {metrics ? `Total: ${metrics.orders_total.toLocaleString()}` : ''}
          </p>
        </div>
      </div>

      {/* Detailed API Metrics */}
      {apiMetrics && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-4">API Performance Details</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Total Requests</p>
              <p className="text-lg font-bold text-gray-900">{apiMetrics.total_requests.toLocaleString()}</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Errors</p>
              <p className={`text-lg font-bold ${apiMetrics.error_count > 0 ? 'text-red-600' : 'text-gray-900'}`}>{apiMetrics.error_count}</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">P50 Response</p>
              <p className="text-lg font-bold text-gray-900">{Math.round(apiMetrics.p50_response_ms)}ms</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">P95 Response</p>
              <p className="text-lg font-bold text-gray-900">{Math.round(apiMetrics.p95_response_ms)}ms</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">P99 Response</p>
              <p className="text-lg font-bold text-gray-900">{Math.round(apiMetrics.p99_response_ms)}ms</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Uptime</p>
              <p className="text-lg font-bold text-gray-900">{apiMetrics.uptime}</p>
            </div>
          </div>
          
          {apiMetrics.status_codes && Object.keys(apiMetrics.status_codes).length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-2">Status Codes</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(apiMetrics.status_codes).map(([code, count]) => (
                  <span key={code} className={`px-2 py-1 rounded text-xs font-medium ${
                    code.startsWith('5') ? 'bg-red-100 text-red-700' :
                    code.startsWith('4') ? 'bg-amber-100 text-amber-700' :
                    code.startsWith('3') ? 'bg-blue-100 text-blue-700' :
                    'bg-emerald-100 text-emerald-700'
                  }`}>
                    {code}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upgrade Recommendations */}
      {metrics && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Upgrade Recommendations</h2>
          <div className="space-y-3">
            {metrics.cpu_usage >= 80 && (
              <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">High CPU Usage ({metrics.cpu_usage}%)</p>
                  <p className="text-xs text-amber-600 mt-1">Consider upgrading to a droplet with more CPU cores. Current usage is consistently above 80%.</p>
                </div>
              </div>
            )}
            {metrics.memory_usage >= 85 && (
              <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-800">High Memory Usage ({metrics.memory_usage}%)</p>
                  <p className="text-xs text-red-600 mt-1">Memory is critically high. Upgrade to a droplet with more RAM to prevent OOM errors.</p>
                </div>
              </div>
            )}
            {metrics.disk_usage >= 80 && (
              <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Disk Space Running Low ({metrics.disk_usage}%)</p>
                  <p className="text-xs text-amber-600 mt-1">Consider adding a volume or upgrading to a larger droplet. Clean up old logs/backups if possible.</p>
                </div>
              </div>
            )}
            {metrics.db_connections >= metrics.db_max_connections * 0.8 && (
              <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Database Connections Near Limit</p>
                  <p className="text-xs text-amber-600 mt-1">{metrics.db_connections}/{metrics.db_max_connections} connections used. Consider increasing max_connections or optimizing queries.</p>
                </div>
              </div>
            )}
            {metrics.cpu_usage < 80 && metrics.memory_usage < 85 && metrics.disk_usage < 80 && metrics.db_connections < metrics.db_max_connections * 0.8 && (
              <div className="flex items-start gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-emerald-800">System is healthy</p>
                  <p className="text-xs text-emerald-600 mt-1">All metrics are within normal ranges. No immediate upgrade needed.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
