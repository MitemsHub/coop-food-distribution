# Load Testing Guide for 3000+ Users

## Overview

This guide provides comprehensive load testing strategies to validate your coop food distribution system's performance under high user loads.

## Prerequisites

### Install Load Testing Tools

```bash
# Install Artillery.js (recommended)
npm install -g artillery

# Alternative: Install k6
choco install k6  # Windows
# or
brew install k6   # macOS
```

## Test Scenarios

### 1. Basic API Load Test

**Create file: `load-tests/basic-api-test.yml`**

```yaml
config:
  target: 'http://localhost:3000'
  phases:
    # Warm-up phase
    - duration: 60
      arrivalRate: 10
      name: "Warm-up"
    # Ramp-up phase
    - duration: 120
      arrivalRate: 50
      name: "Ramp-up"
    # Sustained load
    - duration: 300
      arrivalRate: 100
      name: "Sustained load"
    # Peak load
    - duration: 180
      arrivalRate: 200
      name: "Peak load"
    # Cool-down
    - duration: 60
      arrivalRate: 10
      name: "Cool-down"
  processor: "./test-functions.js"

scenarios:
  - name: "Browse Items"
    weight: 40
    flow:
      - get:
          url: "/api/items/list"
          expect:
            - statusCode: 200
            - hasProperty: "items"
      - think: 2

  - name: "Check Member Eligibility"
    weight: 30
    flow:
      - function: "generateMemberId"
      - get:
          url: "/api/members/eligibility?member_id={{ memberId }}"
          expect:
            - statusCode: [200, 404]
      - think: 1

  - name: "Create Order"
    weight: 20
    flow:
      - function: "generateOrderData"
      - post:
          url: "/api/orders"
          json:
            memberId: "{{ memberId }}"
            deliveryBranchCode: "{{ branchCode }}"
            departmentName: "{{ department }}"
            paymentOption: "{{ paymentOption }}"
            lines: "{{ orderLines }}"
          expect:
            - statusCode: [200, 400, 404]
      - think: 3

  - name: "Admin Order List"
    weight: 10
    flow:
      - get:
          url: "/api/admin/orders/list?status=Pending&limit=20"
          expect:
            - statusCode: 200
      - think: 2
```

**Create file: `load-tests/test-functions.js`**

```javascript
// load-tests/test-functions.js

module.exports = {
  generateMemberId,
  generateOrderData
};

function generateMemberId(context, events, done) {
  // Generate random member ID (adjust range based on your data)
  context.vars.memberId = Math.floor(Math.random() * 1000) + 1;
  return done();
}

function generateOrderData(context, events, done) {
  const branches = ['BR001', 'BR002', 'BR003', 'DUTSE', 'ABUJA', 'LAGOS', 'KANO'];
  const departments = ['General', 'Produce', 'Dairy', 'Bakery'];
  const paymentOptions = ['Cash', 'Savings', 'Loan'];
  const sampleSKUs = ['RICE001', 'BEANS001', 'OIL001', 'SUGAR001', 'SALT001'];
  
  context.vars.memberId = Math.floor(Math.random() * 1000) + 1;
  context.vars.branchCode = branches[Math.floor(Math.random() * branches.length)];
  context.vars.department = departments[Math.floor(Math.random() * departments.length)];
  context.vars.paymentOption = paymentOptions[Math.floor(Math.random() * paymentOptions.length)];
  
  // Generate 1-5 random order lines
  const lineCount = Math.floor(Math.random() * 5) + 1;
  const orderLines = [];
  
  for (let i = 0; i < lineCount; i++) {
    orderLines.push({
      sku: sampleSKUs[Math.floor(Math.random() * sampleSKUs.length)],
      qty: Math.floor(Math.random() * 10) + 1
    });
  }
  
  context.vars.orderLines = orderLines;
  return done();
}
```

### 2. Stress Test for 3000+ Users

**Create file: `load-tests/stress-test.yml`**

```yaml
config:
  target: 'http://localhost:3000'
  phases:
    # Gradual ramp to 3000 users
    - duration: 300  # 5 minutes
      arrivalRate: 200
      name: "Ramp to 1000 users"
    - duration: 300  # 5 minutes
      arrivalRate: 400
      name: "Ramp to 2000 users"
    - duration: 300  # 5 minutes
      arrivalRate: 600
      name: "Ramp to 3000 users"
    # Sustain 3000+ users
    - duration: 600  # 10 minutes
      arrivalRate: 600
      name: "Sustain 3000+ users"
    # Cool down
    - duration: 180
      arrivalRate: 100
      name: "Cool down"
  processor: "./test-functions.js"
  
  # Performance thresholds
  ensure:
    p95: 2000  # 95% of requests should complete within 2 seconds
    p99: 5000  # 99% of requests should complete within 5 seconds
    maxErrorRate: 5  # Maximum 5% error rate

scenarios:
  - name: "Heavy Browse Pattern"
    weight: 50
    flow:
      - loop:
        - get:
            url: "/api/items/list"
        - think: 1
        - get:
            url: "/api/branches/list"
        - think: 2
        count: 3

  - name: "Order Creation Load"
    weight: 30
    flow:
      - function: "generateOrderData"
      - post:
          url: "/api/orders"
          json:
            memberId: "{{ memberId }}"
            deliveryBranchCode: "{{ branchCode }}"
            departmentName: "{{ department }}"
            paymentOption: "Cash"  # Use Cash to avoid eligibility checks
            lines: "{{ orderLines }}"
      - think: 5

  - name: "Admin Operations"
    weight: 20
    flow:
      - get:
          url: "/api/admin/orders/list?status=Pending&limit=50"
      - think: 3
      - get:
          url: "/api/admin/inventory/status"
      - think: 2
```

### 3. Database Connection Test

**Create file: `load-tests/db-connection-test.yml`**

```yaml
config:
  target: 'http://localhost:3000'
  phases:
    # Test connection pool limits
    - duration: 60
      arrivalRate: 50
    - duration: 60
      arrivalRate: 100
    - duration: 60
      arrivalRate: 150
    - duration: 60
      arrivalRate: 200  # This should test connection limits

scenarios:
  - name: "Database Heavy Operations"
    flow:
      - function: "generateMemberId"
      # Multiple DB queries in sequence
      - get:
          url: "/api/members/eligibility?member_id={{ memberId }}"
      - get:
          url: "/api/items/list"
      - function: "generateOrderData"
      - post:
          url: "/api/orders"
          json:
            memberId: "{{ memberId }}"
            deliveryBranchCode: "{{ branchCode }}"
            departmentName: "{{ department }}"
            paymentOption: "Cash"
            lines: "{{ orderLines }}"
```

## Running Load Tests

### 1. Basic Performance Test

```bash
# Navigate to your project directory
cd "C:\Users\USER\Desktop\Coop Food Distribution\coop-food-distribution"

# Create load-tests directory
mkdir load-tests
cd load-tests

# Run basic API test
artillery run basic-api-test.yml
```

### 2. Stress Test for 3000+ Users

```bash
# Run stress test (ensure your system is ready)
artillery run stress-test.yml --output stress-test-results.json

# Generate HTML report
artillery report stress-test-results.json
```

### 3. Database Connection Test

```bash
# Test database connection limits
artillery run db-connection-test.yml
```

## Monitoring During Tests

### 1. System Monitoring Script

**Create file: `load-tests/monitor-system.ps1`**

```powershell
# monitor-system.ps1
# PowerShell script to monitor system resources during load testing

Write-Host "Starting system monitoring..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop monitoring" -ForegroundColor Yellow

try {
    while ($true) {
        Clear-Host
        Write-Host "=== SYSTEM PERFORMANCE MONITOR ===" -ForegroundColor Cyan
        Write-Host "Time: $(Get-Date)" -ForegroundColor White
        Write-Host ""
        
        # CPU Usage
        $cpu = Get-Counter "\Processor(_Total)\% Processor Time" -SampleInterval 1 -MaxSamples 1
        $cpuUsage = [math]::Round($cpu.CounterSamples[0].CookedValue, 2)
        Write-Host "CPU Usage: $cpuUsage%" -ForegroundColor $(if($cpuUsage -gt 80) {"Red"} elseif($cpuUsage -gt 60) {"Yellow"} else {"Green"})
        
        # Memory Usage
        $memory = Get-Counter "\Memory\Available MBytes" -SampleInterval 1 -MaxSamples 1
        $availableMemory = [math]::Round($memory.CounterSamples[0].CookedValue, 0)
        $totalMemory = (Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property capacity -Sum).sum /1mb
        $usedMemory = $totalMemory - $availableMemory
        $memoryPercent = [math]::Round(($usedMemory / $totalMemory) * 100, 2)
        Write-Host "Memory Usage: $memoryPercent% ($usedMemory MB / $totalMemory MB)" -ForegroundColor $(if($memoryPercent -gt 85) {"Red"} elseif($memoryPercent -gt 70) {"Yellow"} else {"Green"})
        
        # Network Usage
        $network = Get-Counter "\Network Interface(*)\Bytes Total/sec" -SampleInterval 1 -MaxSamples 1
        $networkTotal = ($network.CounterSamples | Where-Object {$_.InstanceName -notlike "*Loopback*" -and $_.InstanceName -notlike "*isatap*"} | Measure-Object -Property CookedValue -Sum).Sum
        $networkMbps = [math]::Round($networkTotal / 1MB * 8, 2)
        Write-Host "Network Usage: $networkMbps Mbps" -ForegroundColor White
        
        Write-Host ""
        Write-Host "=== NODE.JS PROCESS INFO ===" -ForegroundColor Cyan
        
        # Node.js processes
        $nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
        if ($nodeProcesses) {
            foreach ($proc in $nodeProcesses) {
                $procCpu = [math]::Round($proc.CPU, 2)
                $procMemory = [math]::Round($proc.WorkingSet / 1MB, 2)
                Write-Host "Node PID $($proc.Id): CPU: $procCpu, Memory: $procMemory MB" -ForegroundColor White
            }
        } else {
            Write-Host "No Node.js processes found" -ForegroundColor Red
        }
        
        Write-Host ""
        Write-Host "Press Ctrl+C to stop monitoring" -ForegroundColor Yellow
        
        Start-Sleep -Seconds 2
    }
}
catch {
    Write-Host "Monitoring stopped." -ForegroundColor Red
}
```

### 2. Database Monitoring Queries

**Create file: `load-tests/db-monitoring.sql`**

```sql
-- Database monitoring queries to run during load testing
-- Run these in Supabase SQL editor during load tests

-- 1. Active connections
SELECT 
    count(*) as active_connections,
    state,
    application_name
FROM pg_stat_activity 
WHERE state IS NOT NULL
GROUP BY state, application_name
ORDER BY active_connections DESC;

-- 2. Slow running queries
SELECT 
    pid,
    now() - pg_stat_activity.query_start AS duration,
    query,
    state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 seconds'
AND state != 'idle'
ORDER BY duration DESC;

-- 3. Lock information
SELECT 
    blocked_locks.pid AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_statement,
    blocking_activity.query AS current_statement_in_blocking_process
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

-- 4. Table statistics during load
SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts_since_start,
    n_tup_upd as updates_since_start,
    n_tup_del as deletes_since_start,
    n_live_tup as current_rows,
    n_dead_tup as dead_rows,
    last_vacuum,
    last_autovacuum
FROM pg_stat_user_tables 
ORDER BY n_tup_ins + n_tup_upd + n_tup_del DESC;

-- 5. Index usage during load
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as times_used,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes 
WHERE idx_scan > 0
ORDER BY idx_scan DESC
LIMIT 20;
```

## Performance Benchmarks

### Target Performance Metrics

| Metric | Target | Critical Threshold |
|--------|--------|-----------------|
| Response Time (P95) | < 1000ms | < 2000ms |
| Response Time (P99) | < 2000ms | < 5000ms |
| Error Rate | < 1% | < 5% |
| Throughput | 500+ RPS | 200+ RPS |
| Concurrent Users | 3000+ | 1000+ |
| Database Connections | < 25 | < 50 |
| CPU Usage | < 70% | < 90% |
| Memory Usage | < 80% | < 95% |

### Load Test Execution Plan

#### Phase 1: Baseline Testing (Before Optimizations)
```bash
# Test current performance
artillery run basic-api-test.yml --output baseline-results.json
artillery report baseline-results.json
```

#### Phase 2: Post-Optimization Testing
```bash
# After applying database indexes and code optimizations
artillery run basic-api-test.yml --output optimized-results.json
artillery report optimized-results.json
```

#### Phase 3: Stress Testing
```bash
# Test with 3000+ users
artillery run stress-test.yml --output stress-results.json
artillery report stress-results.json
```

#### Phase 4: Endurance Testing
```bash
# Long-running test (30 minutes)
artillery run endurance-test.yml --output endurance-results.json
```

## Interpreting Results

### Key Metrics to Monitor

1. **Response Times**
   - P50 (median): Should be < 500ms
   - P95: Should be < 1000ms
   - P99: Should be < 2000ms

2. **Error Rates**
   - HTTP 5xx errors: Should be < 1%
   - HTTP 4xx errors: Monitor for rate limiting (429)
   - Connection errors: Should be 0%

3. **Throughput**
   - Requests per second (RPS)
   - Successful requests per second
   - Failed requests per second

4. **Resource Utilization**
   - CPU usage on server
   - Memory consumption
   - Database connections
   - Network bandwidth

### Warning Signs

🚨 **Stop testing immediately if:**
- Error rate exceeds 10%
- Response times exceed 10 seconds
- CPU usage stays above 95% for more than 2 minutes
- Memory usage exceeds 95%
- Database connection errors occur

### Success Criteria

✅ **System is ready for 3000+ users if:**
- P95 response time < 2000ms under peak load
- Error rate < 5% during stress test
- System recovers gracefully after load spike
- No database connection pool exhaustion
- Memory usage stabilizes under sustained load

## Troubleshooting Common Issues

### High Response Times
- Check database query performance
- Verify indexes are being used
- Monitor for N+1 query problems
- Check network latency

### High Error Rates
- Review application logs
- Check database connection limits
- Verify rate limiting configuration
- Monitor for memory leaks

### Connection Pool Exhaustion
- Increase Supabase connection pool size
- Implement connection retry logic
- Add connection timeout handling
- Monitor for connection leaks

### Memory Issues
- Check for memory leaks in Node.js
- Monitor garbage collection
- Verify cache size limits
- Review large object handling

This comprehensive load testing guide will help you validate that your coop food distribution system can handle 3000+ concurrent users while maintaining acceptable performance levels.