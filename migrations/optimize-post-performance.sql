-- Performance optimization for POST operations
-- This migration adds critical indexes and optimizations for order posting

-- Add indexes for order posting operations
CREATE INDEX IF NOT EXISTS idx_orders_status_order_id ON orders(status, order_id);
CREATE INDEX IF NOT EXISTS idx_orders_pending_status ON orders(order_id) WHERE status = 'Pending';
CREATE INDEX IF NOT EXISTS idx_orders_posted_at ON orders(posted_at) WHERE posted_at IS NOT NULL;

-- Add composite index for common queries
CREATE INDEX IF NOT EXISTS idx_orders_delivery_branch_status ON orders(delivery_branch_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_member_status ON orders(member_id, status);

-- Optimize audit_log table for faster inserts
CREATE INDEX IF NOT EXISTS idx_audit_log_order_id_action ON audit_log(order_id, action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

-- Add index for order lines to speed up order processing
CREATE INDEX IF NOT EXISTS idx_order_lines_order_id_item_id ON order_lines(order_id, item_id);

-- Verify indexes were created
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('orders', 'audit_log', 'order_lines')
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;