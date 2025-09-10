-- Fix existing order status values to use proper capitalization
-- First, let's check what status values currently exist in the database

-- Check current status values and their counts
SELECT status, COUNT(*) as count
FROM orders
GROUP BY status
ORDER BY status;

-- If you see lowercase values in the results above, uncomment and run the UPDATE statements below:

/*
-- Update pending orders to Pending (only if lowercase 'pending' exists)
-- UPDATE orders SET status = 'Pending' WHERE status = 'pending';

-- Update posted orders to Posted (only if lowercase 'posted' exists)
-- UPDATE orders SET status = 'Posted' WHERE status = 'posted';

-- Update delivered orders to Delivered (only if lowercase 'delivered' exists)
-- UPDATE orders SET status = 'Delivered' WHERE status = 'delivered';

-- Update cancelled orders to Cancelled (only if lowercase 'cancelled' exists)
-- UPDATE orders SET status = 'Cancelled' WHERE status = 'cancelled';
*/